/** Read models for the YouTube Studio admin view. Read as the signed-in user (access rules apply). */
import type { Payload, Where } from 'payload'

import { YT_POST_STATUSES, type YtPostStatus } from '@/access/youtube'
import type { User } from '@/payload-types'

import { isoToIst } from './postInput'

export interface PostRow {
  id: number
  title: string
  postType: string
  status: YtPostStatus
  privacyStatus: string
  publishAt: string | null
  updatedAt: string
  youtubeUrl: string | null
  footageTitle: string | null
  reviewNote: string | null
  lastError: string | null
}

export interface PostDetail {
  id: number
  status: YtPostStatus
  form: {
    postType: string
    footage: number | null
    article: number | null
    thumbnail: number | null
    title: string
    description: string
    tags: string
    hashtags: string
    privacyStatus: string
    publishAtIst: string
    notifySubscribers: boolean
    madeForKids: boolean
    containsSyntheticMedia: boolean
  }
  reviewNote: string | null
  submittedAt: string | null
  approvedAt: string | null
  youtubeUrl: string | null
  lastError: string | null
  footage: FootageOption | null
  thumbnailUrl: string | null
  events: { type: string; at: string; actor: string | null; note: string | null }[]
}

export interface FootageOption {
  id: number
  title: string
  notes: string
  orientation: string | null
  durationSeconds: number | null
  sizeMB: number | null
  rightsConfirmed: boolean
  uploader: string | null
}

export interface MediaOption {
  id: number
  url: string
  alt: string
}

export interface ArticleOption {
  id: number
  title: string
}

const as = (user: User) => ({ user, overrideAccess: false as const })
const name = (u: unknown) => (u && typeof u === 'object' ? ((u as { displayName?: string; name?: string }).displayName || (u as { name?: string }).name || null) : null)
const relId = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  return typeof raw === 'number' ? raw : null
}

function footageOption(d: Record<string, unknown>): FootageOption {
  return {
    id: d.id as number,
    title: String(d.title ?? ''),
    notes: String(d.notes ?? ''),
    orientation: (d.orientation as string) ?? null,
    durationSeconds: typeof d.durationSeconds === 'number' ? d.durationSeconds : null,
    sizeMB: typeof d.sizeBytes === 'number' ? Math.round((d.sizeBytes / 1024 / 1024) * 10) / 10 : null,
    rightsConfirmed: Boolean(d.rightsConfirmed),
    uploader: name(d.createdBy),
  }
}

export async function listPosts(payload: Payload, user: User, opts: { statuses?: YtPostStatus[]; limit?: number } = {}): Promise<PostRow[]> {
  const where: Where = opts.statuses?.length ? { status: { in: opts.statuses } } : {}
  const res = await payload.find({ collection: 'youtube-posts', where, sort: '-updatedAt', limit: opts.limit ?? 50, depth: 1, ...as(user) })
  return res.docs.map((d) => ({
    id: d.id,
    title: d.title || '(बिना शीर्षक)',
    postType: d.postType,
    status: d.status,
    privacyStatus: d.privacyStatus,
    publishAt: d.publishAt ?? null,
    updatedAt: d.updatedAt,
    youtubeUrl: d.youtubeUrl ?? null,
    footageTitle: d.footage && typeof d.footage === 'object' ? d.footage.title : null,
    reviewNote: d.reviewNote ?? null,
    lastError: d.lastError ?? null,
  }))
}

export async function statusCounts(payload: Payload, user: User): Promise<Record<YtPostStatus, number>> {
  const entries = await Promise.all(
    YT_POST_STATUSES.map(async (s) => [s, (await payload.count({ collection: 'youtube-posts', where: { status: { equals: s } }, ...as(user) })).totalDocs] as const),
  )
  return Object.fromEntries(entries) as Record<YtPostStatus, number>
}

export async function postDetail(payload: Payload, user: User, id: number): Promise<PostDetail | null> {
  const d = await payload.findByID({ collection: 'youtube-posts', id, depth: 1, disableErrors: true, ...as(user) })
  if (!d) return null
  const events = await payload.find({
    collection: 'youtube-post-events',
    where: { post: { equals: id } },
    sort: '-createdAt',
    limit: 50,
    depth: 1,
    ...as(user),
  })
  const thumb = d.thumbnail && typeof d.thumbnail === 'object' ? d.thumbnail : null
  return {
    id: d.id,
    status: d.status,
    form: {
      postType: d.postType,
      footage: relId(d.footage),
      article: relId(d.article),
      thumbnail: relId(d.thumbnail),
      title: d.title ?? '',
      description: d.description ?? '',
      tags: (d.tags ?? []).join(', '),
      hashtags: (d.hashtags ?? []).join(' '),
      privacyStatus: d.privacyStatus,
      publishAtIst: isoToIst(d.publishAt),
      notifySubscribers: d.notifySubscribers !== false,
      madeForKids: Boolean(d.madeForKids),
      containsSyntheticMedia: Boolean(d.containsSyntheticMedia),
    },
    reviewNote: d.reviewNote ?? null,
    submittedAt: d.submittedAt ?? null,
    approvedAt: d.approvedAt ?? null,
    youtubeUrl: d.youtubeUrl ?? null,
    lastError: d.lastError ?? null,
    footage: d.footage && typeof d.footage === 'object' ? footageOption(d.footage as unknown as Record<string, unknown>) : null,
    thumbnailUrl: thumb ? (thumb.sizes?.card?.url ?? thumb.url ?? null) : null,
    events: events.docs.map((e) => ({
      type: e.type,
      at: e.createdAt,
      actor: name(e.actor),
      note: e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail) ? ((e.detail as { note?: string }).note ?? null) : null,
    })),
  }
}

/** Finished footage that can be used in a post (plus the post's current one, even if older). */
export async function footageOptions(payload: Payload, user: User): Promise<FootageOption[]> {
  const res = await payload.find({
    collection: 'footage',
    where: { uploadStatus: { equals: 'uploaded' } },
    sort: '-createdAt',
    limit: 50,
    depth: 1,
    ...as(user),
  })
  return res.docs.map((d) => footageOption(d as unknown as Record<string, unknown>))
}

export async function thumbnailOptions(payload: Payload, user: User): Promise<MediaOption[]> {
  const res = await payload.find({ collection: 'media', sort: '-createdAt', limit: 24, depth: 0, ...as(user) })
  return res.docs.map((m) => ({ id: m.id, url: m.sizes?.thumb?.url ?? m.url ?? '', alt: m.alt ?? '' }))
}

export async function articleOptions(payload: Payload, user: User): Promise<ArticleOption[]> {
  const res = await payload.find({
    collection: 'articles',
    where: { _status: { equals: 'published' } },
    sort: '-publishedAt',
    limit: 40,
    depth: 0,
    ...as(user),
  })
  return res.docs.map((a) => ({ id: a.id, title: a.title }))
}
