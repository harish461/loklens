/**
 * Server-side session checks for the reporter workspace (architecture §8).
 * Every /reporter page AND every server action calls `requireReporter()`; the layout check alone is
 * never trusted (layouts are not re-run on client navigation, and actions can be called directly).
 */
import config from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'
import { cache } from 'react'

import { isEditorOrAdmin, isReporter, type MaybeUser } from '@/access'
import type { User } from '@/payload-types'

export interface ReporterSession {
  payload: Payload
  user: User
}

/** The signed-in user from the Payload session cookie (validated against stored sessions), or null. */
export const getSessionUser = cache(async (): Promise<{ payload: Payload; user: User | null }> => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() }).catch(() => ({ user: null }))
  return { payload, user: (user as User | null) ?? null }
})

export type ReporterCheck =
  | { ok: true; session: ReporterSession }
  | { ok: false; reason: 'signed-out' | 'inactive' | 'staff' }

/** Non-redirecting check, for server actions that must return an error instead of navigating. */
export async function checkReporter(): Promise<ReporterCheck> {
  const { payload, user } = await getSessionUser()
  if (!user) return { ok: false, reason: 'signed-out' }
  if (isEditorOrAdmin(user as unknown as MaybeUser)) return { ok: false, reason: 'staff' }
  if (!isReporter(user as unknown as MaybeUser)) return { ok: false, reason: 'signed-out' }
  // Re-read the account: the token can outlive an admin's deactivation by up to one request.
  const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true, disableErrors: true })
  if (!fresh || fresh.isActive === false) return { ok: false, reason: 'inactive' }
  return { ok: true, session: { payload, user: fresh as User } }
}

/** For pages: returns the reporter session or redirects (editors/admins → /admin, others → login). */
export async function requireReporter(): Promise<ReporterSession> {
  const check = await checkReporter()
  if (check.ok) return check.session
  if (check.reason === 'staff') redirect('/admin')
  redirect(check.reason === 'inactive' ? '/reporter/login?error=inactive' : '/reporter/login')
}

/** Local-API options that make Payload apply this reporter's access rules and hooks. */
export function asReporter(session: ReporterSession) {
  return { user: session.user, overrideAccess: false as const }
}
