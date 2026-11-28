/**
 * Pure rules for the YouTube publisher (docs/youtube-studio-plan.md §4, §7). No network, no Payload.
 */
export const CHUNK_UNIT = 256 * 1024 // YouTube: every chunk but the last is a multiple of 256 KiB

/** Chunk size in bytes from YOUTUBE_CHUNK_MB (default 8 MiB), rounded to 256 KiB, between 1 and 64 MiB. */
export function chunkBytes(mbSetting: string | undefined): number {
  const mb = Number(mbSetting)
  const wanted = Number.isFinite(mb) && mb > 0 ? Math.min(64, Math.max(1, mb)) : 8
  return Math.max(1, Math.round((wanted * 1024 * 1024) / CHUNK_UNIT)) * CHUNK_UNIT
}

export interface PostForYoutube {
  postType?: string | null
  title?: string | null
  description?: string | null
  tags?: string[] | null
  hashtags?: string[] | null
  categoryId?: string | null
  defaultLanguage?: string | null
  privacyStatus?: string | null
  publishAt?: string | null
  madeForKids?: boolean | null
  containsSyntheticMedia?: boolean | null
}

/** Description as sent: the text, then the hashtags on their own line (YouTube shows the first three above the title). */
export function fullDescription(post: PostForYoutube): string {
  const tags = (post.hashtags ?? []).filter(Boolean)
  const text = (post.description ?? '').trim()
  return tags.length ? `${text}${text ? '\n\n' : ''}${tags.join(' ')}` : text
}

/**
 * The `video` resource for videos.insert. privacyStatus is always explicit (YouTube defaults to public);
 * a schedule uploads as private with publishAt, and YouTube publishes it at that time.
 */
export function videoResource(post: PostForYoutube, now: Date) {
  const publishAt = post.publishAt && new Date(post.publishAt).getTime() > now.getTime() + 60_000 ? new Date(post.publishAt).toISOString() : null
  const privacy = publishAt ? 'private' : post.privacyStatus === 'public' || post.privacyStatus === 'private' ? post.privacyStatus : 'unlisted'
  return {
    snippet: {
      title: (post.title ?? '').trim(),
      description: fullDescription(post),
      tags: (post.tags ?? []).filter(Boolean),
      categoryId: post.categoryId || '25',
      defaultLanguage: post.defaultLanguage || 'hi',
      defaultAudioLanguage: post.defaultLanguage || 'hi',
    },
    status: {
      privacyStatus: privacy,
      ...(publishAt ? { publishAt } : {}),
      selfDeclaredMadeForKids: Boolean(post.madeForKids),
      containsSyntheticMedia: Boolean(post.containsSyntheticMedia),
      embeddable: true,
    },
  }
}

export function youtubeUrl(videoId: string, postType: string | null | undefined): string {
  return postType === 'short' ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`
}

/** Start of "today" in India time, as a Date (for the daily upload limit). */
export function istDayStart(now: Date): Date {
  const ist = new Date(now.getTime() + 330 * 60_000)
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000)
}

/** Parses YouTube's "Range: bytes=0-12345" (308 response) → next offset; no header = nothing stored yet. */
export function offsetFromRange(range: string | null): number {
  const m = range ? /bytes=0-(\d+)/.exec(range) : null
  return m ? Number(m[1]) + 1 : 0
}

export type ErrorKind = 'quota' | 'auth' | 'permanent' | 'retry' | 'session'

/** How to react to a YouTube API error. */
export function classifyError(status: number, reason: string | null | undefined): ErrorKind {
  const r = reason ?? ''
  if (/quotaExceeded|uploadLimitExceeded|rateLimitExceeded|userRateLimitExceeded|dailyLimitExceeded/i.test(r)) return 'quota'
  if (status === 401 || /invalid_grant|unauthorized|authError/i.test(r)) return 'auth'
  if (status === 404 || status === 410) return 'session'
  if (status === 429 || status >= 500 || status === 0) return 'retry'
  return 'permanent'
}

/** Backoff between attempts of the same step: 1, 2, 4, 8, 16, 30, 30 … minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(30, 2 ** Math.max(0, attempts - 1)) * 60_000
}

export const MAX_ATTEMPTS = 8

/** When to look at a video that is processing on YouTube again: 2 min at first, then 5, then 15. */
export function pollDelayMs(sinceUploadMs: number): number {
  if (sinceUploadMs < 10 * 60_000) return 2 * 60_000
  if (sinceUploadMs < 60 * 60_000) return 5 * 60_000
  return 15 * 60_000
}

/** A short, secret-free error text for the post (no URLs with tokens, no upload URIs). */
export function safeError(message: string): string {
  return message.replace(/https?:\/\/\S+/g, '[url]').replace(/(access_token|upload_id|key)=[^&\s]+/gi, '$1=…').slice(0, 300)
}
