/**
 * Cleans what the YouTube Studio editor form sends (pure; no Payload). Only allow-listed fields pass; status,
 * approval and job fields are never taken from the client (the guard in access/youtube.ts also enforces that).
 */
import { YT_LIMITS } from '@/access/youtubeLimits'

export interface PostFormInput {
  postType?: unknown
  footage?: unknown
  article?: unknown
  thumbnail?: unknown
  title?: unknown
  description?: unknown
  /** Comma- or newline-separated. */
  tags?: unknown
  /** Space-, comma- or newline-separated; "#" is added when missing. */
  hashtags?: unknown
  privacyStatus?: unknown
  /** "YYYY-MM-DDTHH:mm" in India time (from <input type="datetime-local">), or empty. */
  publishAtIst?: unknown
  notifySubscribers?: unknown
  madeForKids?: unknown
  containsSyntheticMedia?: unknown
}

const id = (v: unknown) => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null
}
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '')

export function parseTags(v: unknown): string[] {
  if (typeof v !== 'string') return []
  // De-duplicated case-insensitively; the first occurrence's casing is kept.
  const out: string[] = []
  const used = new Set<string>()
  for (const raw of v.split(/[,\n]/)) {
    const t = raw.replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, 100)
    if (t && !used.has(t.toLowerCase())) {
      used.add(t.toLowerCase())
      out.push(t)
    }
  }
  return out.slice(0, 50)
}

export function parseHashtags(v: unknown): string[] {
  if (typeof v !== 'string') return []
  const out: string[] = []
  const used = new Set<string>()
  for (const raw of v.split(/[\s,]+/)) {
    const body = raw.replace(/^#+/, '').trim()
    if (!body) continue
    const tag = `#${body}`.slice(0, 60)
    if (!used.has(tag.toLowerCase())) {
      used.add(tag.toLowerCase())
      out.push(tag)
    }
  }
  return out.slice(0, YT_LIMITS.hashtags + 5) // the guard reports more than 15 as an error instead of trimming silently
}

/** "2026-12-01T18:30" (IST) → ISO string; empty → null; invalid → undefined. */
export function istToIso(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return undefined
  const d = new Date(`${v}:00+05:30`)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** ISO → "YYYY-MM-DDTHH:mm" in India time, for the form. */
export function isoToIst(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 330 * 60_000)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16)
}

export function cleanPostInput(input: PostFormInput): { data: Record<string, unknown>; errors: string[] } {
  const errors: string[] = []
  const publishAt = istToIso(input.publishAtIst)
  if (publishAt === undefined) errors.push('शेड्यूल का समय सही नहीं है।')
  const privacy = ['public', 'unlisted', 'private'].includes(String(input.privacyStatus)) ? String(input.privacyStatus) : 'unlisted'
  const data: Record<string, unknown> = {
    postType: input.postType === 'short' ? 'short' : 'video',
    footage: id(input.footage),
    article: id(input.article),
    thumbnail: id(input.thumbnail),
    title: text(input.title, YT_LIMITS.titleChars + 50), // longer titles reach the guard and get a clear message
    description: typeof input.description === 'string' ? input.description.replace(/\r\n/g, '\n').slice(0, 10000) : '',
    tags: parseTags(input.tags),
    hashtags: parseHashtags(input.hashtags),
    privacyStatus: privacy,
    publishAt: publishAt ?? null,
    notifySubscribers: input.notifySubscribers !== false,
    madeForKids: input.madeForKids === true,
    containsSyntheticMedia: input.containsSyntheticMedia === true,
  }
  return { data, errors }
}

/** The four checks an admin must tick before approving (review tab). */
export const REVIEW_CHECKLIST = ['rights', 'minors', 'defamation', 'accuracy'] as const
export type ReviewChecklist = Partial<Record<(typeof REVIEW_CHECKLIST)[number], unknown>>

export function checklistComplete(c: ReviewChecklist | null | undefined): boolean {
  return Boolean(c) && REVIEW_CHECKLIST.every((k) => c?.[k] === true)
}
