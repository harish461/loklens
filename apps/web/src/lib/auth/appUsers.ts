/**
 * Customer accounts for the mobile app (docs/api-contract.md §7). Wraps Payload's own auth operations on the
 * `app-users` collection so passwords, lockout and tokens follow Payload's rules. Responses are shaped
 * explicitly, so no internal field (sessions, Google subject, reset token, collection name) ever leaks.
 */
import { randomBytes } from 'node:crypto'

import config from '@payload-config'
import { AuthenticationError, LockedAuth, ValidationError, getPayload, type Payload } from 'payload'

export const APP_USERS = 'app-users' as const

export interface AppUser {
  id: number
  name: string
  email: string
  provider: 'password' | 'google'
  createdAt: string
}

/** Public shape of a customer. Anything else on the stored document is dropped here. */
export function toAppUser(doc: Record<string, unknown>): AppUser {
  return {
    id: Number(doc.id),
    name: String(doc.name ?? ''),
    email: String(doc.email ?? ''),
    provider: doc.provider === 'google' ? 'google' : 'password',
    createdAt: String(doc.createdAt ?? ''),
  }
}

export class AuthApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: 'UNAUTHORIZED' | 'CONFLICT' | 'VALIDATION' | 'TOO_MANY_REQUESTS' | 'SERVER_ERROR',
    message: string,
  ) {
    super(message)
  }
}

/** Maps Payload errors to the contract's status codes. */
export function toAuthError(err: unknown): AuthApiError {
  if (err instanceof AuthApiError) return err
  if (err instanceof AuthenticationError) return new AuthApiError(401, 'UNAUTHORIZED', 'ईमेल या पासवर्ड गलत है।')
  if (err instanceof LockedAuth) return new AuthApiError(429, 'TOO_MANY_REQUESTS', 'बहुत अधिक प्रयास। 15 मिनट बाद फिर कोशिश करें।')
  if (err instanceof ValidationError) {
    const errors = (err.data as { errors?: { path?: string; message?: string }[] } | undefined)?.errors ?? []
    if (errors.some((e) => e.path === 'email' && /unique|already|exist/i.test(e.message ?? ''))) {
      return new AuthApiError(409, 'CONFLICT', 'यह ईमेल पहले से पंजीकृत है।')
    }
    return new AuthApiError(422, 'VALIDATION', 'कृपया सही जानकारी भरें।')
  }
  console.error('[LokLens auth] unexpected error:', err)
  return new AuthApiError(500, 'SERVER_ERROR', 'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।')
}

export async function db(): Promise<Payload> {
  return getPayload({ config })
}

/** Validates a new password: 8+ characters (contract §7). */
export function assertPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new AuthApiError(422, 'VALIDATION', 'पासवर्ड कम से कम 8 अक्षर का होना चाहिए।')
  }
  return password
}

export function assertEmail(email: unknown): string {
  const value = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
    throw new AuthApiError(422, 'VALIDATION', 'कृपया सही ईमेल पता लिखें।')
  }
  return value
}

/** The session id (`sid`) inside a Payload JWT. The token was already verified by payload.auth. */
export function sessionIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { sid?: string }
    return typeof payload.sid === 'string' ? payload.sid : null
  } catch {
    return null
  }
}

/** Current customer from `Authorization: JWT …`, or null. Staff tokens are rejected. */
export async function currentAppUser(headers: Headers): Promise<{ id: number; doc: Record<string, unknown>; token: string } | null> {
  const payload = await db()
  const { user } = await payload.auth({ headers }).catch(() => ({ user: null }))
  const doc = user as (Record<string, unknown> & { collection?: string }) | null
  if (!doc || doc.collection !== APP_USERS) return null
  const token = (headers.get('authorization') ?? '').replace(/^JWT\s+/i, '')
  return { id: Number(doc.id), doc, token }
}

/** Random password for Google-created accounts (they never sign in with a password). */
export function randomPassword(): string {
  return randomBytes(32).toString('base64url')
}

export interface GoogleClaims {
  sub: string
  email: string
  name: string
}

/**
 * Verifies a Google ID token with Google's tokeninfo endpoint and checks the audience against the
 * configured client IDs (GOOGLE_CLIENT_IDS, comma-separated: Android, iOS and web clients).
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleClaims> {
  const allowed = (process.env.GOOGLE_CLIENT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (allowed.length === 0) throw new AuthApiError(500, 'SERVER_ERROR', 'Google sign-in is not configured.')
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)
  if (!res || !res.ok) throw new AuthApiError(401, 'UNAUTHORIZED', 'Google sign-in could not be verified.')
  const claims = (await res.json()) as { aud?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string }
  if (!claims.aud || !allowed.includes(claims.aud)) throw new AuthApiError(401, 'UNAUTHORIZED', 'Google sign-in could not be verified.')
  if (!claims.sub || !claims.email || String(claims.email_verified) !== 'true') {
    throw new AuthApiError(401, 'UNAUTHORIZED', 'Google sign-in needs a verified Google email.')
  }
  return { sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name?.trim() || claims.email.split('@')[0] }
}

export { type Payload }
