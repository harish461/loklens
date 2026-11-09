/**
 * YouTube channel feed → SocialPost[] (architecture §"Social feeds on the home page").
 * Uses the public Atom feed, so no API key. Server-side only: call it from Server Components.
 */
import type { SocialFeed, SocialPost } from './types'

export const YOUTUBE_CHANNEL_ID = 'UCQ9BfhKRBEESTPyscj1JmCg'
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@loklensnews'
export const YOUTUBE_FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`

const REVALIDATE_SECONDS = 900 // new uploads show within ~15 min
const TIMEOUT_MS = 3000
export const TITLE_MAX = 120

// ---- pure helpers (unit-tested) ------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export function decodeXmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Trim to ~max characters at a word boundary (safe for Devanagari: never cuts inside a word). */
export function trimText(text: string, max = TITLE_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** Any parseable date → ISO 8601 with IST offset ("2026-11-09T11:09:48+05:30"); null if invalid. */
export function toISTString(input: string): string | null {
  const t = Date.parse(input)
  if (Number.isNaN(t)) return null
  return new Date(t + 330 * 60_000).toISOString().replace(/\.\d{3}Z$/, '+05:30')
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))
  if (!m) return undefined
  const raw = m[1].trim()
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/)
  return cdata ? cdata[1] : decodeXmlEntities(raw)
}

function attr(block: string, element: string, name: string): string | undefined {
  const el = block.match(new RegExp(`<${element}\\s[^>]*>`))
  const m = el?.[0].match(new RegExp(`\\s${name}="([^"]*)"`))
  return m ? decodeXmlEntities(m[1]) : undefined
}

/**
 * Parses the YouTube Atom feed. Dependency-free on purpose: the feed format is small and stable.
 * Entries without a valid video id or date are skipped. Returns newest first, at most `limit`.
 */
export function parseYouTubeFeed(xml: string, limit = 3): SocialPost[] {
  const posts: SocialPost[] = []
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = m[1]
    const id = tag(entry, 'yt:videoId')
    const publishedAt = toISTString(tag(entry, 'published') ?? '')
    if (!id || !/^[\w-]{11}$/.test(id) || !publishedAt) continue
    const link = attr(entry, 'link', 'href')
    let url = `https://www.youtube.com/watch?v=${id}`
    try {
      if (link && ['www.youtube.com', 'youtube.com'].includes(new URL(link).hostname)) url = link
    } catch {
      // keep the watch URL
    }
    posts.push({
      platform: 'youtube',
      id,
      title: trimText(tag(entry, 'title') ?? ''),
      url,
      // hqdefault (480×360) is 16:9 content letterboxed in 4:3; a 16:9 object-fit crop removes the bars.
      thumbnail: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, width: 480, height: 360 },
      publishedAt,
    })
  }
  return posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit)
}

// ---- fetch ---------------------------------------------------------------------------------------

/** Latest uploads. Never throws: any failure returns `{ status: 'error', posts: [] }` and logs once. */
export async function getYouTubeLatest(limit = 3): Promise<SocialFeed> {
  try {
    const res = await fetch(YOUTUBE_FEED_URL, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ['social'] },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { status: 'ok', posts: parseYouTubeFeed(await res.text(), limit) }
  } catch (err) {
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.warn(`[social] youtube feed unavailable (${reason})`)
    return { status: 'error', posts: [] }
  }
}
