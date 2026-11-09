/**
 * Access rules as pure functions of the user (and, where needed, the document). They return either
 * a boolean or a Payload `Where` object. The thin Payload adapters live in ./index.ts.
 */
import type { Where } from 'payload'

import { isAdmin, isEditorOrAdmin, isReporter, isStaff, sameId, type MaybeUser } from './roles'

export const PUBLISHED: Where = { _status: { equals: 'published' } }

/**
 * Read rule for collections with drafts (Articles, Videos, Pages).
 * - anonymous / unknown role: published only
 * - reporter: published + anything they created
 * - editor/admin: everything
 */
export function readPublishedOrStaff(user: MaybeUser): boolean | Where {
  if (isEditorOrAdmin(user)) return true
  if (isReporter(user) && user) {
    return { or: [PUBLISHED, { createdBy: { equals: user.id } }] }
  }
  return PUBLISHED
}

/**
 * Article update rule.
 * - editor/admin: any article
 * - reporter: only articles they created that have never been published (status still draft)
 * - others: nothing
 */
export function updateArticle(user: MaybeUser): boolean | Where {
  if (isEditorOrAdmin(user)) return true
  if (isReporter(user) && user) {
    return {
      and: [{ createdBy: { equals: user.id } }, { _status: { not_equals: 'published' } }],
    }
  }
  return false
}

export function createArticle(user: MaybeUser): boolean {
  return isStaff(user)
}

/** Deleting articles is an editorial decision. */
export function deleteArticle(user: MaybeUser): boolean {
  return isEditorOrAdmin(user)
}

/** Field-level: editorial flags (isBreaking/isTrending/isFeatured/breakingUntil). */
export function canSetEditorialFlags(user: MaybeUser): boolean {
  return isEditorOrAdmin(user)
}

/** Fields only newsroom users may read (e.g. createdBy). Hidden from the public API. */
export function canReadInternal(user: MaybeUser): boolean {
  return isStaff(user)
}

/** Users.email (and role): admins, or the user reading their own record. */
export function canReadUserPrivateField(user: MaybeUser, docId: unknown): boolean {
  if (isAdmin(user)) return true
  return Boolean(user && sameId(user.id, docId))
}

/** Users: admins edit anyone; everyone else only their own profile. */
export function updateUser(user: MaybeUser): boolean | Where {
  if (isAdmin(user)) return true
  if (isStaff(user) && user) return { id: { equals: user.id } }
  return false
}

/** Media: editors/admins edit everything, reporters only what they uploaded. */
export function updateMedia(user: MaybeUser): boolean | Where {
  if (isEditorOrAdmin(user)) return true
  if (isReporter(user) && user) return { createdBy: { equals: user.id } }
  return false
}

export interface PublishGuardInput {
  user: MaybeUser
  /** Incoming data. */
  data: Record<string, unknown>
  /** Stored document before the change (update only). */
  originalDoc?: Record<string, unknown> | null
}

export const EDITORIAL_FLAGS = ['isBreaking', 'isTrending', 'isFeatured', 'breakingUntil'] as const

/**
 * Decides what a change may do, independent of Payload. Returns a list of violations;
 * empty = allowed. Requests without a user (seed scripts, jobs, overrideAccess) are trusted.
 */
export function publishGuardViolations({ user, data, originalDoc }: PublishGuardInput): string[] {
  if (!user || isEditorOrAdmin(user)) return []
  const violations: string[] = []
  if (!isStaff(user)) violations.push('Only newsroom users may change articles.')
  if (data._status === 'published') violations.push('Reporters cannot publish. Save a draft for an editor to review.')
  for (const flag of EDITORIAL_FLAGS) {
    if (!(flag in data)) continue
    const incoming = data[flag] ?? null
    const current = originalDoc?.[flag] ?? null
    const changed =
      flag === 'breakingUntil' ? toTime(incoming) !== toTime(current) : Boolean(incoming) !== Boolean(current)
    if (changed) violations.push(`Reporters cannot change "${flag}".`)
  }
  return violations
}

function toTime(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const t = new Date(value as string).getTime()
  return Number.isNaN(t) ? null : t
}
