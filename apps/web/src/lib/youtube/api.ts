/**
 * YouTube Data API v3 calls used by the publisher (fetch only, no SDK). Every call has a timeout. Errors carry
 * the HTTP status and YouTube's reason code (e.g. quotaExceeded), never tokens or upload URLs.
 */
import { googleAccessToken } from '@/lib/google/oauth'

import { offsetFromRange } from './publishPlan'

export class YoutubeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string | null,
  ) {
    super(message)
    this.name = 'YoutubeApiError'
  }
}

async function fail(res: Response, what: string): Promise<never> {
  const text = await res.text().catch(() => '')
  let reason: string | null = null
  let message = ''
  try {
    const body = JSON.parse(text) as { error?: { message?: string; errors?: { reason?: string }[] } | string }
    if (typeof body.error === 'object') {
      reason = body.error.errors?.[0]?.reason ?? null
      message = body.error.message ?? ''
    } else if (typeof body.error === 'string') reason = body.error
  } catch {
    message = text.slice(0, 200)
  }
  throw new YoutubeApiError(`${what}: HTTP ${res.status}${reason ? ` ${reason}` : ''}${message ? ` – ${message}` : ''}`, res.status, reason)
}

async function auth(): Promise<string> {
  return `Bearer ${await googleAccessToken()}`
}

/** videos.insert (resumable): returns the session URI. Costs the upload quota (1 of 100 per day). */
export async function createUploadSession(resource: object, sizeBytes: number, mimeType: string, notifySubscribers: boolean): Promise<string> {
  const url = `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${notifySubscribers ? 'true' : 'false'}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: await auth(),
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(sizeBytes),
      'X-Upload-Content-Type': mimeType,
    },
    body: JSON.stringify(resource),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) await fail(res, 'videos.insert')
  const location = res.headers.get('location')
  if (!location) throw new YoutubeApiError('videos.insert: no upload URL returned', res.status, null)
  return location
}

export type UploadState = { done: false; offset: number } | { done: true; videoId: string }

/** Asks how many bytes YouTube has (after a restart, a lost connection or a new cron run). */
export async function queryUpload(sessionUri: string, sizeBytes: number): Promise<UploadState> {
  const res = await fetch(sessionUri, {
    method: 'PUT',
    headers: { Authorization: await auth(), 'Content-Range': `bytes */${sizeBytes}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (res.status === 200 || res.status === 201) return { done: true, videoId: ((await res.json()) as { id: string }).id }
  if (res.status === 308) return { done: false, offset: offsetFromRange(res.headers.get('range')) }
  return fail(res, 'upload status')
}

/** Sends bytes start..start+body.length-1. Returns YouTube's new offset, or the video ID when complete. */
export async function putChunk(sessionUri: string, body: Uint8Array, start: number, sizeBytes: number, mimeType: string): Promise<UploadState> {
  const end = start + body.length - 1
  const res = await fetch(sessionUri, {
    method: 'PUT',
    headers: { Authorization: await auth(), 'Content-Range': `bytes ${start}-${end}/${sizeBytes}`, 'Content-Type': mimeType },
    body: Buffer.from(body),
    signal: AbortSignal.timeout(90_000),
  })
  if (res.status === 200 || res.status === 201) return { done: true, videoId: ((await res.json()) as { id: string }).id }
  if (res.status === 308) return { done: false, offset: offsetFromRange(res.headers.get('range')) }
  return fail(res, 'upload chunk')
}

export interface VideoState {
  uploadStatus: string | null
  failureReason: string | null
  rejectionReason: string | null
  privacyStatus: string | null
  publishAt: string | null
  processingStatus: string | null
}

/** videos.list (1 quota unit). Null when the video no longer exists. */
export async function getVideoState(videoId: string): Promise<VideoState | null> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(videoId)}`, {
    headers: { Authorization: await auth() },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) await fail(res, 'videos.list')
  const item = ((await res.json()) as { items?: { status?: Record<string, string>; processingDetails?: Record<string, string> }[] }).items?.[0]
  if (!item) return null
  return {
    uploadStatus: item.status?.uploadStatus ?? null,
    failureReason: item.status?.failureReason ?? null,
    rejectionReason: item.status?.rejectionReason ?? null,
    privacyStatus: item.status?.privacyStatus ?? null,
    publishAt: item.status?.publishAt ?? null,
    processingStatus: item.processingDetails?.processingStatus ?? null,
  }
}

/** thumbnails.set (~50 quota units). Needs a verified channel. */
export async function setThumbnail(videoId: string, jpeg: Uint8Array): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
    method: 'POST',
    headers: { Authorization: await auth(), 'Content-Type': 'image/jpeg' },
    body: Buffer.from(jpeg),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) await fail(res, 'thumbnails.set')
}
