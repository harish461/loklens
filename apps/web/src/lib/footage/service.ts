/**
 * Footage upload flow (server side). The browser:
 *   1. startFootageUpload → a footage row + presigned PUT URLs for every segment
 *   2. PUTs each ≤45 MiB segment straight to the private bucket (retry per segment)
 *   3. completeFootageUpload → the server lists the stored segments, checks sizes and the container magic, and
 *      marks the row uploaded.
 * Resume after a reload or a lost connection: resumeFootageUpload returns URLs only for segments still missing.
 *
 * The caller (server actions) has already checked the session. Here the row is read AS THAT USER
 * (overrideAccess: false), so the footage access rules decide ownership; storage fields are then written with
 * overrideAccess, because clients may never set them.
 */
import { randomBytes } from 'node:crypto'

import type { Payload } from 'payload'

import { isEditorOrAdmin, type MaybeUser } from '@/access'
import { parseHashtags } from '@/lib/youtube/postInput'
import type { Footage, User } from '@/payload-types'

import {
  cleanVideoFacts,
  detectContainer,
  missingSegments,
  segmentCount,
  segmentKey,
  SEGMENT_BYTES,
  validateStart,
  type StartRequest,
} from './segments'
import { deletePrefix, footageBucket, listPrefix, presignSegmentPut, readHead } from './storage'

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string }

export interface UploadPlan {
  footageId: number
  segmentBytes: number
  segmentCount: number
  /** Presigned URLs for the segments still missing (1-based numbers). */
  segments: { n: number; url: string }[]
}

export interface StartInput extends StartRequest {
  notes?: unknown
  location?: unknown
  category?: unknown
  /** Media ID of a suggested thumbnail image (uploaded first through /api/media). */
  image?: unknown
  /** Suggested hashtags, space- or comma-separated ("#" is added when missing). */
  hashtags?: unknown
}

/** A media ID only if it exists and is an image the user may read. */
async function imageId(payload: Payload, user: User, v: unknown): Promise<number | null> {
  const id = positiveId(v)
  if (!id) return null
  const m = await payload.findByID({ collection: 'media', id, depth: 0, disableErrors: true, ...as(user) })
  return m && /^image\//.test(m.mimeType ?? '') ? m.id : null
}

const DAY_MS = 24 * 3600 * 1000
const as = (user: User) => ({ user, overrideAccess: false as const })
const positiveId = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null)

async function settings(payload: Payload) {
  const s = await payload.findGlobal({ slug: 'youtube-settings', overrideAccess: true, depth: 0 })
  return {
    maxBytes: Math.max(50, Number(s.maxFootageMB) || 2048) * 1024 * 1024,
    retentionDays: Math.max(1, Number(s.footageRetentionDays) || 30),
  }
}

/** The row as the user may see it, or null (not found, or not theirs). */
async function ownFootage(payload: Payload, user: User, id: unknown): Promise<Footage | null> {
  const footageId = positiveId(id)
  if (!footageId) return null
  return (await payload.findByID({ collection: 'footage', id: footageId, depth: 0, disableErrors: true, ...as(user) })) as Footage | null
}

async function plan(row: Footage): Promise<UploadPlan> {
  const prefix = row.storagePrefix as string
  const size = Number(row.sizeBytes)
  const missing = missingSegments(prefix, size, await listPrefix(prefix))
  const segments = await Promise.all(missing.map(async (n) => ({ n, url: await presignSegmentPut(segmentKey(prefix, n)) })))
  return { footageId: row.id, segmentBytes: SEGMENT_BYTES, segmentCount: segmentCount(size), segments }
}

export async function startFootageUpload(payload: Payload, user: User, input: StartInput): Promise<Result<UploadPlan>> {
  const { maxBytes } = await settings(payload)
  const v = validateStart(input, maxBytes)
  if (!v.ok) return { ok: false, error: v.errors.join(' ') }

  const created = await payload.create({
    collection: 'footage',
    data: {
      title: v.value.title,
      notes: typeof input.notes === 'string' ? input.notes.trim().slice(0, 2000) : undefined,
      location: positiveId(input.location),
      category: positiveId(input.category),
      image: await imageId(payload, user, input.image),
      hashtags: parseHashtags(input.hashtags).slice(0, 15),
      rightsConfirmed: true,
      // Ignored for clients by field access (the default 'uploading' applies); present to satisfy the type.
      uploadStatus: 'uploading',
    },
    ...as(user),
  })
  // Random part: the prefix is not guessable from the row ID.
  const prefix = `footage/${created.id}-${randomBytes(6).toString('hex')}`
  const row = (await payload.update({
    collection: 'footage',
    id: created.id,
    data: {
      storagePrefix: prefix,
      bucket: footageBucket(),
      filename: v.value.filename,
      mimeType: v.value.mimeType,
      sizeBytes: v.value.sizeBytes,
      segmentBytes: SEGMENT_BYTES,
      segmentCount: segmentCount(v.value.sizeBytes),
      uploadStatus: 'uploading',
    },
    overrideAccess: true,
  })) as Footage
  return { ok: true, ...(await plan(row)) }
}

/** Fresh URLs for the segments still missing. Only for the uploader's own unfinished upload (or editors). */
export async function resumeFootageUpload(payload: Payload, user: User, footageId: unknown, sizeBytes: unknown): Promise<Result<UploadPlan>> {
  const row = await ownFootage(payload, user, footageId)
  if (!row || row.uploadStatus !== 'uploading' || !row.storagePrefix) return { ok: false, error: 'This upload can no longer be resumed. Start again.' }
  if (Number(row.sizeBytes) !== sizeBytes) return { ok: false, error: 'This is not the same file. Start again.' }
  if (!isEditorOrAdmin(user as unknown as MaybeUser) && String(idOf(row.createdBy)) !== String(user.id)) {
    return { ok: false, error: 'This upload is not yours.' }
  }
  return { ok: true, ...(await plan(row)) }
}

export async function completeFootageUpload(
  payload: Payload,
  user: User,
  footageId: unknown,
  facts: { durationSeconds?: unknown; width?: unknown; height?: unknown },
): Promise<Result<{ footageId: number }>> {
  const row = await ownFootage(payload, user, footageId)
  if (!row || !row.storagePrefix) return { ok: false, error: 'Footage not found.' }
  if (row.uploadStatus === 'uploaded') return { ok: true, footageId: row.id }
  if (row.uploadStatus !== 'uploading') return { ok: false, error: 'This upload was cancelled.' }

  const prefix = row.storagePrefix
  const missing = missingSegments(prefix, Number(row.sizeBytes), await listPrefix(prefix))
  if (missing.length) return { ok: false, error: `${missing.length} part(s) have not been uploaded yet. Try again.` }

  const container = detectContainer(await readHead(segmentKey(prefix, 1)))
  if (!container) {
    await deletePrefix(prefix)
    await payload.update({ collection: 'footage', id: row.id, data: { uploadStatus: 'failed' }, overrideAccess: true })
    return { ok: false, error: 'This file is not an MP4, MOV or WebM video.' }
  }

  const { retentionDays } = await settings(payload)
  await payload.update({
    collection: 'footage',
    id: row.id,
    data: {
      ...cleanVideoFacts(facts),
      uploadStatus: 'uploaded',
      // Unused footage is deleted after the retention period; a post that uses it extends this (Phase 5/7).
      retainUntil: new Date(Date.now() + retentionDays * DAY_MS).toISOString(),
    },
    overrideAccess: true,
  })
  return { ok: true, footageId: row.id }
}

/** Stops an upload, or deletes unused footage: removes the segments and marks the row deleted. */
export async function discardFootage(payload: Payload, user: User, footageId: unknown): Promise<Result<object>> {
  const row = await ownFootage(payload, user, footageId)
  if (!row) return { ok: false, error: 'Footage not found.' }
  const editor = isEditorOrAdmin(user as unknown as MaybeUser)
  if (!editor && (String(idOf(row.createdBy)) !== String(user.id) || row.lockedAt)) return { ok: false, error: 'You cannot delete this footage.' }
  const usedBy = await payload.count({
    collection: 'youtube-posts',
    where: { and: [{ footage: { equals: row.id } }, { status: { not_in: ['cancelled'] } }] },
    overrideAccess: true,
  })
  if (usedBy.totalDocs > 0) return { ok: false, error: 'This footage is used by a YouTube post.' }
  if (row.storagePrefix) await deletePrefix(row.storagePrefix)
  await payload.update({ collection: 'footage', id: row.id, data: { uploadStatus: 'deleted', retainUntil: null }, overrideAccess: true })
  return { ok: true }
}

function idOf(v: unknown): unknown {
  return v && typeof v === 'object' ? (v as { id?: unknown }).id : v
}
