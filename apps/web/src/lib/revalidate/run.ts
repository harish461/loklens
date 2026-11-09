import { CACHE_TAG_PATTERN } from './tags'

/**
 * Expires Next.js data-cache tags.
 *
 * - Outside the Next.js server (seed scripts, `payload` CLI) there is no cache to expire → no-op.
 * - Inside a Next request (admin save via REST / server function) → `revalidateTag(tag, { expire: 0 })`.
 * - Inside Next but outside a request (Payload jobs run by autoRun: scheduled publish, breaking expiry)
 *   `revalidateTag` throws "static generation store missing", so we POST the tags to our own
 *   `/api/revalidate` route, authenticated with REVALIDATE_SECRET.
 * Never throws.
 */
export async function expireCacheTags(tags: string[], log: (msg: string) => void = (m) => console.warn(m)): Promise<void> {
  const valid = [...new Set(tags)].filter((t) => CACHE_TAG_PATTERN.test(t))
  if (valid.length === 0) return
  if (!process.env.NEXT_RUNTIME) return

  try {
    const { revalidateTag } = await import('next/cache')
    for (const tag of valid) revalidateTag(tag, { expire: 0 })
    return
  } catch (err) {
    if (!/static generation store missing/i.test((err as Error).message ?? '')) {
      log(`[revalidate] revalidateTag failed: ${(err as Error).message}`)
      return
    }
  }
  await postToRevalidateRoute(valid, log)
}

export function internalBaseUrl(): string {
  const port = process.env.PORT ?? '3000'
  return `http://127.0.0.1:${port}`
}

async function postToRevalidateRoute(tags: string[], log: (msg: string) => void): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    log('[revalidate] REVALIDATE_SECRET is not set; background revalidation skipped')
    return
  }
  try {
    const res = await fetch(`${internalBaseUrl()}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) log(`[revalidate] /api/revalidate returned HTTP ${res.status}`)
  } catch (err) {
    log(`[revalidate] /api/revalidate request failed: ${(err as Error).message}`)
  }
}
