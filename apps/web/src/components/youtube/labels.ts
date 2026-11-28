import type { YtPostStatus } from '@/access/youtubeLimits'

// YouTube Studio UI text is English (user decision 2026-11-28); the content (titles, descriptions) stays Hindi.

export const STATUS_LABEL: Record<YtPostStatus, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  approved: 'Approved (queued)',
  uploading: 'Uploading',
  processing: 'Processing on YouTube',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export const STATUS_TONE: Record<YtPostStatus, 'neutral' | 'warn' | 'ok' | 'bad' | 'info'> = {
  draft: 'neutral',
  pending_review: 'warn',
  approved: 'info',
  uploading: 'info',
  processing: 'info',
  scheduled: 'ok',
  published: 'ok',
  failed: 'bad',
  cancelled: 'neutral',
}

export const PRIVACY_LABEL: Record<string, string> = { public: 'Public', unlisted: 'Unlisted (link only)', private: 'Private' }

export const EVENT_LABEL: Record<string, string> = {
  created: 'Created',
  submitted: 'Sent for review',
  rejected: 'Returned',
  approved: 'Approved',
  upload_started: 'Upload started',
  chunk: 'Uploading',
  uploaded: 'Upload finished',
  thumbnail_set: 'Thumbnail set',
  processed: 'Processed by YouTube',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
  retried: 'Retried',
  cancelled: 'Cancelled',
}

export const ORIENTATION_LABEL: Record<string, string> = { landscape: 'Landscape', vertical: 'Vertical', square: 'Square' }

export const CHECKLIST_LABEL = {
  rights: 'The footage is ours, and the people shown agreed to be filmed.',
  minors: 'No minor, victim or accused person can be identified.',
  defamation: 'No defamatory or unverified allegations in the video or the text.',
  accuracy: 'The title and description are accurate, not misleading.',
} as const

export function formatIst(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
