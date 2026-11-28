/**
 * Google OAuth for server jobs (YouTube Studio; later AI Studio). Exchanges the long-lived refresh token from the
 * one-time channel consent for a short-lived access token, cached in memory until shortly before it expires.
 * Env (server only): YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET, YOUTUBE_OAUTH_REFRESH_TOKEN.
 * Values are never logged.
 */
const NAMES = ['YOUTUBE_OAUTH_CLIENT_ID', 'YOUTUBE_OAUTH_CLIENT_SECRET', 'YOUTUBE_OAUTH_REFRESH_TOKEN'] as const

let cached: { token: string; expiresAt: number } | null = null

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GoogleAuthError'
  }
}

/** Names (never values) of missing settings. */
export function googleOAuthProblems(): string[] {
  return NAMES.filter((n) => !process.env[n]?.trim())
}

export async function googleAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const missing = googleOAuthProblems()
  if (missing.length) throw new GoogleAuthError(`Missing ${missing.join(', ')}`, 0)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID!.trim(),
      client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET!.trim(),
      refresh_token: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN!.trim(),
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string }
  if (!res.ok || !body.access_token) {
    // invalid_grant = the consent was revoked or the refresh token expired: someone must reconnect the channel.
    throw new GoogleAuthError(`Google token refresh failed: ${body.error ?? res.status}`, res.status)
  }
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 }
  return cached.token
}

/** For tests. */
export function clearGoogleTokenCache(): void {
  cached = null
}
