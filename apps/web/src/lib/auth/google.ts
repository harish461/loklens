/**
 * Google ID token verification (server side). Checks the token locally against Google's published signing keys:
 * - signature (RS256, key from Google's JWKS, matched by `kid`)
 * - issuer: accounts.google.com or https://accounts.google.com
 * - audience: must be one of the configured audiences (the WEB client ID)
 * - expiry (`exp`, with a 60-second clock allowance) and not-before (`nbf`)
 * - `email_verified` is true and `sub` and `email` are present
 *
 * Kept free of Payload imports so it can be unit-tested with locally generated keys.
 */
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from 'jose'

export const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'] as const
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'

export class GoogleTokenError extends Error {
  /**
   * Why the token was rejected, for the server log only (never sent to the client). Holds error codes and
   * public client IDs, never the token itself or the user's email.
   */
  readonly reason: string

  constructor(message: string, reason: string = message) {
    super(message)
    this.name = 'GoogleTokenError'
    this.reason = reason
  }
}

/** Builds a log-safe reason from a `jose` verification error. */
function describeVerifyFailure(err: unknown, idToken: string, audiences: string[]): string {
  const e = (err ?? {}) as { code?: unknown; claim?: unknown; name?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : typeof e.name === 'string' ? e.name : 'unknown error'
  const claim = typeof e.claim === 'string' ? ` (claim: ${e.claim})` : ''
  let detail = ''
  if (e.claim === 'aud') {
    // The audience is a public OAuth client ID; logging it shows which client the app asked Google for.
    let tokenAud = 'unreadable'
    try {
      const aud = decodeJwt(idToken).aud
      tokenAud = Array.isArray(aud) ? aud.join(',') : String(aud)
    } catch {
      // keep 'unreadable'
    }
    detail = `; token aud=${tokenAud}; accepted=${audiences.join(',')}`
  } else if (!claim && typeof e.message === 'string') {
    detail = `; ${e.message.slice(0, 200)}`
  }
  return `${code}${claim}${detail}`
}

export interface GoogleIdentity {
  sub: string
  email: string
  name: string
}

let remoteKeys: JWTVerifyGetKey | null = null
/** Google's keys, cached by `jose` and refreshed when an unknown `kid` appears. */
function defaultKeys(): JWTVerifyGetKey {
  remoteKeys ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL), { cooldownDuration: 30_000 })
  return remoteKeys
}

/** The audiences this server accepts: `GOOGLE_CLIENT_IDS`, comma-separated (use the Web client ID). */
export function configuredAudiences(): string[] {
  return (process.env.GOOGLE_CLIENT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function verifyGoogleIdentityToken(
  idToken: string,
  options: { audiences?: string[]; keys?: JWTVerifyGetKey } = {},
): Promise<GoogleIdentity> {
  const audiences = options.audiences ?? configuredAudiences()
  if (audiences.length === 0) throw new GoogleTokenError('GOOGLE_CLIENT_IDS is not configured.')

  let payload: Record<string, unknown>
  try {
    const verified = await jwtVerify(idToken, options.keys ?? defaultKeys(), {
      issuer: [...GOOGLE_ISSUERS],
      audience: audiences,
      algorithms: ['RS256'],
      clockTolerance: 60,
    })
    payload = verified.payload as Record<string, unknown>
  } catch (err) {
    throw new GoogleTokenError('Google token failed verification.', describeVerifyFailure(err, idToken, audiences))
  }

  const emailVerified = payload.email_verified === true || payload.email_verified === 'true'
  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  if (!emailVerified) throw new GoogleTokenError('Google email is not verified.')
  if (!sub || !email) throw new GoogleTokenError('Google token has no identity.')

  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : email.split('@')[0]
  return { sub, email, name }
}
