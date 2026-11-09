import { unstable_cache } from 'next/cache'

/** Safety net for time-based expiry (architecture §4): breaking labels and any missed tag purge. */
export const REVALIDATE_SECONDS = 300

/**
 * Wraps a read in Next's data cache under the given tags (architecture §4). The function must return
 * JSON-serialisable data (the serializer guarantees this) and must never return raw Payload documents.
 *
 * Outside the Next.js server (seed, verify and other `payload run` scripts) there is no cache store, and
 * unstable_cache throws. NEXT_RUNTIME is only set inside Next, so scripts run the same query uncached.
 */
export function cachedRead<T>(keyParts: string[], tags: string[], fn: () => Promise<T>): Promise<T> {
  if (!process.env.NEXT_RUNTIME) return fn()
  return unstable_cache(fn, keyParts, { tags: [...new Set(tags)], revalidate: REVALIDATE_SECONDS })()
}
