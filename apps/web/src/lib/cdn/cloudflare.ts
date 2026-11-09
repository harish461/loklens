/**
 * Cloudflare cache purge (architecture §4). No-op unless CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN
 * are set, so local development and CI never call out. Never throws: a failed purge only logs, the
 * time-based safety net (s-maxage / revalidate 300) still expires the content.
 */
const CF_API = 'https://api.cloudflare.com/client/v4'
const MAX_FILES_PER_REQUEST = 30
const TIMEOUT_MS = 5000

export function isCloudflareConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN)
}

/** Turns site paths into absolute URLs on NEXT_PUBLIC_SITE_URL. */
export function toAbsoluteUrls(paths: string[], siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''): string[] {
  const base = siteUrl.replace(/\/+$/, '')
  if (!base) return []
  return [...new Set(paths.map((p) => (p.startsWith('http') ? p : `${base}${p.startsWith('/') ? p : `/${p}`}`)))]
}

export async function purgeCloudflareUrls(
  paths: string[],
  log: (msg: string) => void = (m) => console.warn(m),
): Promise<void> {
  if (!isCloudflareConfigured() || paths.length === 0) return
  const files = toAbsoluteUrls(paths)
  for (let i = 0; i < files.length; i += MAX_FILES_PER_REQUEST) {
    const chunk = files.slice(i, i + MAX_FILES_PER_REQUEST)
    try {
      const res = await fetch(`${CF_API}/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: chunk }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) log(`[cloudflare] purge failed: HTTP ${res.status}`)
    } catch (err) {
      log(`[cloudflare] purge error: ${(err as Error).message}`)
    }
  }
}
