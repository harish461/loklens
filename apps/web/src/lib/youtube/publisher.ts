/**
 * YouTube publisher: ONE short step per call (cron `POST /api/cron?queue=youtube`, every minute, 1 job).
 * A step picks the most urgent post, takes a lease on it (so two runners never work on the same post), does a
 * bounded amount of work and saves where it stopped:
 *
 *   approved   → check approval + daily limit → open a resumable upload session (videos.insert) → uploading
 *   uploading  → ask YouTube for its offset → send ≤ budget of chunks read from the footage segments → processing
 *   processing → set the thumbnail (videos only) → poll videos.list → published / scheduled / failed
 *   scheduled  → after publishAt, confirm it went public → published
 *
 * Every write runs with context.youtubeJob, so the guard (access/youtube.ts) checks the transition and that the
 * stored post still matches what the admin approved. Errors: quota → wait; network/5xx → retry with backoff
 * (failed after MAX_ATTEMPTS); expired upload session → start a new session; anything else → failed.
 */
import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'
import sharp from 'sharp'

import { approvalStillValid } from '@/access/youtube'
import { readFootageRange, readMediaObject } from '@/lib/footage/storage'
import { GoogleAuthError, googleOAuthProblems } from '@/lib/google/oauth'
import type { Footage, Media, YoutubePost } from '@/payload-types'

import { createUploadSession, getVideoState, putChunk, queryUpload, setThumbnail, YoutubeApiError } from './api'
import { youtubeStudioEnabled } from './flags'
import {
  backoffMs,
  chunkBytes,
  classifyError,
  istDayStart,
  MAX_ATTEMPTS,
  pollDelayMs,
  safeError,
  videoResource,
  youtubeUrl,
} from './publishPlan'

export type StepResult =
  | { action: 'idle'; reason: string }
  | { action: 'busy'; postId: number }
  | { action: string; postId: number; detail?: Record<string, unknown> }

type EventType = 'upload_started' | 'chunk' | 'uploaded' | 'thumbnail_set' | 'processed' | 'scheduled' | 'published' | 'failed'

const LEASE_SECONDS = 150
const JOB = { overrideAccess: true, context: { youtubeJob: true } } as const
const DAY_MS = 24 * 3600 * 1000

interface Ctx {
  payload: Payload
  req?: PayloadRequest
  now: () => Date
  started: number
  budgetMs: number
}

const relId = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  return typeof raw === 'number' ? raw : null
}

async function event(c: Ctx, postId: number, type: EventType, detail?: Record<string, unknown>) {
  await c.payload.create({ collection: 'youtube-post-events', data: { post: postId, type, actor: null, detail: detail ?? null }, overrideAccess: true, req: c.req })
}

async function save(c: Ctx, id: number, data: Partial<YoutubePost>): Promise<YoutubePost> {
  return (await c.payload.update({ collection: 'youtube-posts', id, data, depth: 0, ...JOB, req: c.req })) as YoutubePost
}

async function claim(payload: Payload, id: number): Promise<boolean> {
  const res = (await payload.db.drizzle.execute(sql`
    UPDATE "youtube_posts" SET "lease_until" = now() + make_interval(secs => ${LEASE_SECONDS})
    WHERE "id" = ${id} AND ("lease_until" IS NULL OR "lease_until" < now())
    RETURNING "id"`)) as { rows: unknown[] }
  return res.rows.length === 1
}

async function release(payload: Payload, id: number) {
  await payload.db.drizzle.execute(sql`UPDATE "youtube_posts" SET "lease_until" = NULL WHERE "id" = ${id}`)
}

/** The next post that needs work, most urgent first. */
async function nextPost(c: Ctx): Promise<YoutubePost | null> {
  const nowIso = c.now().toISOString()
  const due = { or: [{ nextCheckAt: { exists: false } }, { nextCheckAt: { less_than_equal: nowIso } }] }
  for (const [status, sort] of [
    ['uploading', 'uploadStartedAt'],
    ['processing', 'uploadStartedAt'],
    ['scheduled', 'publishAt'],
    ['approved', 'approvedAt'],
  ] as const) {
    const res = await c.payload.find({
      collection: 'youtube-posts',
      where: { and: [{ status: { equals: status } }, due] },
      sort,
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req: c.req,
    })
    if (res.docs[0]) return res.docs[0] as YoutubePost
  }
  return null
}

export async function runPublisherStep(payload: Payload, opts: { req?: PayloadRequest; now?: () => Date; budgetMs?: number } = {}): Promise<StepResult> {
  if (!youtubeStudioEnabled()) return { action: 'idle', reason: 'YOUTUBE_STUDIO_ENABLED is off' }
  const settings = await payload.findGlobal({ slug: 'youtube-settings', depth: 0, overrideAccess: true, req: opts.req })
  if (!settings.enabled) return { action: 'idle', reason: 'uploads are switched off in YouTube settings' }
  const missing = googleOAuthProblems()
  if (missing.length) return { action: 'idle', reason: `missing ${missing.join(', ')}` }

  const c: Ctx = { payload, req: opts.req, now: opts.now ?? (() => new Date()), started: Date.now(), budgetMs: opts.budgetMs ?? 40_000 }
  const post = await nextPost(c)
  if (!post) return { action: 'idle', reason: 'nothing to do' }
  if (!(await claim(payload, post.id))) return { action: 'busy', postId: post.id }
  try {
    // Re-read after the lease: another runner may have moved it on.
    const fresh = (await payload.findByID({ collection: 'youtube-posts', id: post.id, depth: 0, overrideAccess: true, req: c.req })) as YoutubePost
    return await step(c, fresh, settings)
  } catch (err) {
    return await handleError(c, post.id, err)
  } finally {
    await release(payload, post.id)
  }
}

type Settings = { dailyUploadLimit?: number | null; footageRetentionDays?: number | null }

async function step(c: Ctx, post: YoutubePost, settings: Settings): Promise<StepResult> {
  switch (post.status) {
    case 'approved':
      return startUpload(c, post, settings)
    case 'uploading':
      return continueUpload(c, post)
    case 'processing':
      return checkProcessing(c, post, settings)
    case 'scheduled':
      return checkScheduled(c, post, settings)
    default:
      return { action: 'skip', postId: post.id }
  }
}

async function loadFootage(c: Ctx, post: YoutubePost): Promise<Footage | null> {
  const id = relId(post.footage)
  if (!id) return null
  const f = (await c.payload.findByID({ collection: 'footage', id, depth: 0, overrideAccess: true, disableErrors: true, req: c.req })) as Footage | null
  return f && f.uploadStatus === 'uploaded' && f.storagePrefix && f.sizeBytes && f.segmentBytes ? f : null
}

async function fail(c: Ctx, post: YoutubePost, message: string, detail: Record<string, unknown> = {}): Promise<StepResult> {
  const lastError = safeError(message)
  await save(c, post.id, { status: 'failed', lastError, nextCheckAt: null, uploadSessionUri: null })
  await event(c, post.id, 'failed', { error: lastError, ...detail })
  return { action: 'failed', postId: post.id, detail: { error: lastError } }
}

async function startUpload(c: Ctx, post: YoutubePost, settings: Settings): Promise<StepResult> {
  const now = c.now()
  if (!approvalStillValid(post as unknown as Record<string, unknown>)) return fail(c, post, 'The approval no longer matches this post.')

  const limit = Math.max(1, Number(settings.dailyUploadLimit) || 20)
  const today = await c.payload.count({
    collection: 'youtube-posts',
    where: { uploadStartedAt: { greater_than_equal: istDayStart(now).toISOString() } },
    overrideAccess: true,
    req: c.req,
  })
  if (today.totalDocs >= limit) {
    const tomorrow = new Date(istDayStart(now).getTime() + DAY_MS + 5 * 60_000)
    await save(c, post.id, { nextCheckAt: tomorrow.toISOString() })
    return { action: 'daily-limit', postId: post.id, detail: { limit } }
  }

  const footage = await loadFootage(c, post)
  if (!footage) return fail(c, post, 'The footage is missing or not fully uploaded.')

  const uri = await createUploadSession(videoResource(post, now), Number(footage.sizeBytes), footage.mimeType || 'video/mp4', post.notifySubscribers !== false)
  const updated = await save(c, post.id, {
    status: 'uploading',
    uploadSessionUri: uri,
    uploadStartedAt: now.toISOString(),
    bytesUploaded: 0,
    attempts: 0,
    lastError: null,
    nextCheckAt: null,
  })
  await event(c, post.id, 'upload_started', { bytes: footage.sizeBytes })
  return continueUpload(c, updated)
}

async function continueUpload(c: Ctx, post: YoutubePost): Promise<StepResult> {
  const footage = await loadFootage(c, post)
  if (!footage) return fail(c, post, 'The footage is missing or not fully uploaded.')
  const size = Number(footage.sizeBytes)
  const mime = footage.mimeType || 'video/mp4'

  let uri = post.uploadSessionUri
  if (!uri) {
    // The previous session expired: start a new one (costs one more upload from the daily quota).
    uri = await createUploadSession(videoResource(post, c.now()), size, mime, post.notifySubscribers !== false)
    await save(c, post.id, { uploadSessionUri: uri, bytesUploaded: 0 })
  }

  let state = await queryUpload(uri, size)
  const chunk = chunkBytes(process.env.YOUTUBE_CHUNK_MB)
  const startOffset = state.done ? size : state.offset
  // At least one chunk per run; then stop early enough that the next chunk still fits in the request time
  // (Hostinger 120 s, Cloudflare ~100 s).
  let sentChunks = 0
  while (!state.done && (sentChunks++ === 0 || Date.now() - c.started < c.budgetMs)) {
    const start = state.offset
    const end = Math.min(start + chunk, size) - 1
    const bytes = await readFootageRange(footage.storagePrefix as string, Number(footage.segmentBytes), start, end)
    state = await putChunk(uri, bytes, start, size, mime)
  }

  if (state.done) {
    const videoId = state.videoId
    await save(c, post.id, {
      status: 'processing',
      youtubeVideoId: videoId,
      youtubeUrl: youtubeUrl(videoId, post.postType),
      bytesUploaded: size,
      uploadSessionUri: null,
      attempts: 0,
      nextCheckAt: new Date(c.now().getTime() + 60_000).toISOString(),
    })
    await event(c, post.id, 'uploaded', { videoId })
    return { action: 'uploaded', postId: post.id, detail: { videoId } }
  }
  await save(c, post.id, { bytesUploaded: state.offset, attempts: 0 })
  await event(c, post.id, 'chunk', { from: startOffset, to: state.offset, of: size })
  return { action: 'chunk', postId: post.id, detail: { offset: state.offset, size } }
}

/** JPEG for thumbnails.set: 1280×720 cover crop, under 2 MB. */
async function thumbnailJpeg(c: Ctx, mediaId: number): Promise<Uint8Array | null> {
  const media = (await c.payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true, disableErrors: true, req: c.req })) as Media | null
  if (!media?.filename) return null
  const original = await readMediaObject(`${media.prefix || 'images'}/${media.filename}`)
  for (const quality of [88, 80, 70, 60]) {
    const out = await sharp(original).rotate().resize(1280, 720, { fit: 'cover', position: 'centre' }).jpeg({ quality, mozjpeg: true }).toBuffer()
    if (out.length < 2 * 1024 * 1024) return out
  }
  return null
}

async function trySetThumbnail(c: Ctx, post: YoutubePost): Promise<void> {
  const mediaId = relId(post.thumbnail)
  // Shorts use a frame YouTube picks; custom thumbnails only for regular videos.
  if (!mediaId || post.postType === 'short' || post.thumbnailSetAt || !post.youtubeVideoId) return
  try {
    const jpeg = await thumbnailJpeg(c, mediaId)
    if (!jpeg) throw new Error('Could not read or convert the thumbnail image.')
    await setThumbnail(post.youtubeVideoId, jpeg)
    await save(c, post.id, { thumbnailSetAt: c.now().toISOString() })
    await event(c, post.id, 'thumbnail_set', { bytes: jpeg.length })
  } catch (err) {
    const kind = err instanceof YoutubeApiError ? classifyError(err.status, err.reason) : 'permanent'
    if (kind === 'retry' || kind === 'quota') return // try again on the next poll
    // Not worth failing the video for: record it once and move on (e.g. 403 when the channel is not verified).
    await save(c, post.id, { thumbnailSetAt: c.now().toISOString() })
    await event(c, post.id, 'thumbnail_set', { error: safeError((err as Error).message) })
  }
}

async function releaseFootage(c: Ctx, post: YoutubePost, settings: Settings) {
  const id = relId(post.footage)
  if (!id) return
  const days = Math.max(1, Number(settings.footageRetentionDays) || 30)
  await c.payload.update({
    collection: 'footage',
    id,
    data: { lockedAt: null, retainUntil: new Date(c.now().getTime() + days * DAY_MS).toISOString() },
    overrideAccess: true,
    req: c.req,
  })
}

async function checkProcessing(c: Ctx, post: YoutubePost, settings: Settings): Promise<StepResult> {
  await trySetThumbnail(c, post)
  const videoId = post.youtubeVideoId as string
  const state = await getVideoState(videoId)
  if (!state) return fail(c, post, 'The video no longer exists on YouTube.')
  if (state.uploadStatus === 'failed' || state.uploadStatus === 'rejected' || state.uploadStatus === 'deleted') {
    return fail(c, post, `YouTube ${state.uploadStatus} the video: ${state.failureReason ?? state.rejectionReason ?? 'no reason given'}.`)
  }
  if (state.uploadStatus !== 'processed') {
    const since = c.now().getTime() - new Date(post.uploadStartedAt ?? c.now()).getTime()
    await save(c, post.id, { nextCheckAt: new Date(c.now().getTime() + pollDelayMs(since)).toISOString() })
    return { action: 'processing', postId: post.id, detail: { processingStatus: state.processingStatus } }
  }
  await event(c, post.id, 'processed', { privacy: state.privacyStatus })
  const publishAt = state.publishAt ? new Date(state.publishAt).getTime() : 0
  if (publishAt > c.now().getTime()) {
    await save(c, post.id, { status: 'scheduled', nextCheckAt: new Date(publishAt + 2 * 60_000).toISOString() })
    await event(c, post.id, 'scheduled', { publishAt: state.publishAt })
    return { action: 'scheduled', postId: post.id }
  }
  await save(c, post.id, { status: 'published', publishedAt: c.now().toISOString(), nextCheckAt: null })
  await event(c, post.id, 'published', { privacy: state.privacyStatus, url: post.youtubeUrl })
  await releaseFootage(c, post, settings)
  return { action: 'published', postId: post.id }
}

async function checkScheduled(c: Ctx, post: YoutubePost, settings: Settings): Promise<StepResult> {
  const state = await getVideoState(post.youtubeVideoId as string)
  if (!state) return fail(c, post, 'The video no longer exists on YouTube.')
  if (state.privacyStatus === 'public') {
    await save(c, post.id, { status: 'published', publishedAt: c.now().toISOString(), nextCheckAt: null })
    await event(c, post.id, 'published', { privacy: 'public', scheduled: true })
    await releaseFootage(c, post, settings)
    return { action: 'published', postId: post.id }
  }
  await save(c, post.id, { nextCheckAt: new Date(c.now().getTime() + 10 * 60_000).toISOString() })
  return { action: 'waiting-for-schedule', postId: post.id }
}

async function handleError(c: Ctx, postId: number, err: unknown): Promise<StepResult> {
  const post = (await c.payload.findByID({ collection: 'youtube-posts', id: postId, depth: 0, overrideAccess: true, disableErrors: true, req: c.req })) as YoutubePost | null
  const message = safeError((err as Error)?.message ?? String(err))
  c.payload.logger.error(`[youtube] post ${postId}: ${message}`)
  if (!post || !['approved', 'uploading', 'processing', 'scheduled'].includes(post.status)) return { action: 'error', postId, detail: { error: message } }

  const kind =
    err instanceof YoutubeApiError
      ? classifyError(err.status, err.reason)
      : err instanceof GoogleAuthError
        ? 'auth'
        : 'retry' // network errors, timeouts, S3 hiccups
  const now = c.now().getTime()
  if (kind === 'permanent') return fail(c, post, message)
  if (kind === 'session') {
    // The upload URL expired or was rejected: the next step opens a new session.
    await save(c, post.id, { uploadSessionUri: null, bytesUploaded: 0, lastError: message, nextCheckAt: new Date(now + 60_000).toISOString() })
    return { action: 'session-reset', postId }
  }
  if (kind === 'quota' || kind === 'auth') {
    // Not this post's fault: wait without using up its attempts. Auth needs someone to reconnect the channel.
    await save(c, post.id, { lastError: message, nextCheckAt: new Date(now + (kind === 'quota' ? 60 : 30) * 60_000).toISOString() })
    return { action: kind === 'quota' ? 'quota-wait' : 'auth-wait', postId }
  }
  const attempts = (Number(post.attempts) || 0) + 1
  if (attempts >= MAX_ATTEMPTS) return fail(c, post, `${message} (gave up after ${attempts} attempts)`)
  await save(c, post.id, { attempts, lastError: message, nextCheckAt: new Date(now + backoffMs(attempts)).toISOString() })
  return { action: 'retry-later', postId, detail: { attempts } }
}
