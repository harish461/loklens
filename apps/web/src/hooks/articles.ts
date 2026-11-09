import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { publishGuardViolations, type MaybeUser } from '../access'
import { relId } from './revalidate'

export const BREAKING_DEFAULT_HOURS = 6
export const MIN_FEATURED_IMAGE_WIDTH = 1200

/**
 * Defence in depth for §8: field-level access already strips flags for reporters; this guard also
 * blocks publishing (_status is a system field without field access) and any flag change that
 * slipped through. Trusted calls (no user: seed, jobs) pass.
 */
export const guardReporterChanges: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const violations = publishGuardViolations({
    user: req.user as MaybeUser,
    data: data as Record<string, unknown>,
    originalDoc: originalDoc as Record<string, unknown> | undefined,
  })
  if (violations.length > 0) throw new APIError(violations.join(' '), 403, undefined, true)
  return data
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
