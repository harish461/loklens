/**
 * Role model (architecture §8). Pure helpers with no Payload imports so they can be unit-tested.
 *
 * reporter: create/edit own drafts, upload media; cannot publish or set breaking/trending/featured
 * editor:   publish/unpublish any article; manage categories, tags, locations, videos, e-paper; set flags
 * admin:    everything, incl. users, settings, pages and redirects
 */
export const ROLES = ['admin', 'editor', 'reporter'] as const
export type Role = (typeof ROLES)[number]

/** Minimal user shape the helpers need (matches the generated `User` type structurally). */
export interface AccessUser {
  id: number | string
  role?: Role | null
  collection?: string
}

export type MaybeUser = AccessUser | null | undefined

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function hasRole(user: MaybeUser, ...roles: Role[]): boolean {
  return Boolean(user && isRole(user.role) && roles.includes(user.role))
}

/** Any signed-in newsroom user with a valid role. */
export function isStaff(user: MaybeUser): boolean {
  return hasRole(user, 'admin', 'editor', 'reporter')
}

export function isEditorOrAdmin(user: MaybeUser): boolean {
  return hasRole(user, 'admin', 'editor')
}

export function isAdmin(user: MaybeUser): boolean {
  return hasRole(user, 'admin')
}

export function isReporter(user: MaybeUser): boolean {
  return hasRole(user, 'reporter')
}

export function sameId(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false
  return String(a) === String(b)
}
