/**
 * YouTube Studio constants and limits that the browser also needs (no Node or Payload imports, so client
 * components can use them). The rules that use them live in ./youtube.ts.
 */
export const YT_POST_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'uploading',
  'processing',
  'scheduled',
  'published',
  'failed',
  'cancelled',
] as const
export type YtPostStatus = (typeof YT_POST_STATUSES)[number]

/** Statuses only the publisher job may set. */
export const YT_JOB_STATUSES: readonly YtPostStatus[] = ['uploading', 'processing', 'scheduled', 'published', 'failed']

/** Once a post reaches these, what went to YouTube is frozen (no videos.update in Release 1). */
export const YT_LOCKED_STATUSES: readonly YtPostStatus[] = ['uploading', 'processing', 'scheduled', 'published', 'cancelled']

export const YT_LIMITS = {
  titleChars: 100,
  descriptionBytes: 5000,
  tagsChars: 500,
  hashtags: 15,
  shortMaxSeconds: 180,
} as const

/** YouTube counts a tag with a space as if it were quoted (+2), and adds a separator between tags. */
export function tagsLength(tags: readonly string[]): number {
  return tags.reduce((n, t) => n + [...t].length + (t.includes(' ') ? 2 : 0), 0) + Math.max(0, tags.length - 1)
}
