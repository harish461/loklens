import { APIError, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'

import {
  isReporter,
  publishGuardViolations,
  reporterWorkflowViolations,
  workflowPatch,
  type MaybeUser,
  type ReporterPermissions,
} from '../access'
import { relId } from './revalidate'

export const BREAKING_DEFAULT_HOURS = 6
export const MIN_FEATURED_IMAGE_WIDTH = 1200

/**
 * A reporter's admin-controlled permissions, read fresh from the database on every write so a change
 * by the admin (deactivate, revoke canPublish, reassign categories) applies at once, not at next login.
 */
async function reporterPermissions(req: PayloadRequest): Promise<ReporterPermissions | null> {
  const user = req.user as MaybeUser
  if (!user || !isReporter(user)) return null
  const doc = await req.payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })
  if (!doc) return { isActive: false }
  return {
    isActive: doc.isActive !== false,
    canPublish: Boolean(doc.canPublish),
    assignedCategories: (doc.assignedCategories as unknown[] | null | undefined) ?? [],
  }
}

/**
 * Defence in depth for §8: field-level access already strips flags for reporters; this guard also
 * blocks publishing without permission (_status is a system field without field access), flag changes
 * that slipped through, editor-only workflow moves, review fields, other reporters' articles and
 * categories outside the reporter's assignment. Trusted calls (no user: seed, jobs) pass.
 */
export const guardReporterChanges: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const user = req.user as MaybeUser
  const permissions = await reporterPermissions(req)
  const input = {
    user,
    data: data as Record<string, unknown>,
    originalDoc: originalDoc as Record<string, unknown> | undefined,
  }
  const violations = [
    ...publishGuardViolations({ ...input, canPublish: Boolean(permissions?.canPublish) }),
    ...reporterWorkflowViolations({ ...input, permissions }),
  ]
  if (violations.length > 0) throw new APIError([...new Set(violations)].join(' '), 403, undefined, true)
  return data
}

/** Keeps workflowStatus / review stamps in sync with `_status` (src/access/workflow.ts). Runs after the guard. */
export const syncWorkflow: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const { patch, violations } = workflowPatch({
    user: req.user as MaybeUser,
    data: data as Record<string, unknown>,
    originalDoc: originalDoc as Record<string, unknown> | undefined,
  })
  if (violations.length > 0) throw new APIError(violations.join(' '), 400, undefined, true)
  return { ...data, ...patch }
}

/** Pure: computes publish-time defaults. Exported for tests. */
export function applyPublishDefaults(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | undefined,
  now: Date = new Date(),
): Record<string, unknown> {
  const next = { ...data }
  const publishing = next._status === 'published'
  if (publishing && !next.publishedAt && !originalDoc?.publishedAt) {
    next.publishedAt = now.toISOString()
  }
  const isBreaking = Boolean(next.isBreaking ?? originalDoc?.isBreaking)
  const wasBreaking = Boolean(originalDoc?.isBreaking)
  const breakingUntil = next.breakingUntil ?? originalDoc?.breakingUntil
  const newlyProvided =
    Boolean(next.breakingUntil) && toTime(next.breakingUntil) !== toTime(originalDoc?.breakingUntil)
  // Default to publish (or now, if later) + 6 h when breaking is switched on without an explicit end,
  // or when it is on but has no end at all.
  if (isBreaking && (!breakingUntil || (!wasBreaking && !newlyProvided))) {
    const base = new Date((next.publishedAt ?? originalDoc?.publishedAt ?? now.toISOString()) as string)
    const from = base.getTime() > now.getTime() ? base : now
    next.breakingUntil = new Date(from.getTime() + BREAKING_DEFAULT_HOURS * 3600_000).toISOString()
  }
  return next
}

function toTime(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const t = new Date(value as string).getTime()
  return Number.isNaN(t) ? null : t
}

export const setPublishDefaults: CollectionBeforeChangeHook = ({ data, originalDoc }) =>
  applyPublishDefaults(data as Record<string, unknown>, originalDoc as Record<string, unknown> | undefined)

/** Featured image is required (and ≥ 1200 px wide) only when publishing; drafts may omit it. */
export const requireFeaturedImageOnPublish: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (data._status !== 'published') return data
  const imageId = relId(data.featuredImage ?? originalDoc?.featuredImage)
  if (imageId === null) {
    throw new APIError('A featured image is required before publishing.', 400, undefined, true)
  }
  const media = await req.payload.findByID({
    collection: 'media',
    id: imageId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })
  if (!media) throw new APIError('The featured image no longer exists.', 400, undefined, true)
  if (typeof media.width === 'number' && media.width < MIN_FEATURED_IMAGE_WIDTH) {
    throw new APIError(
      `The featured image must be at least ${MIN_FEATURED_IMAGE_WIDTH}px wide (it is ${media.width}px).`,
      400,
      undefined,
      true,
    )
  }
  return data
}
