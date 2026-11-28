/**
 * Footage retention (docs/youtube-studio-plan.md §6): deletes the stored segments of
 * - uploaded footage whose `retainUntil` has passed (default 30 days; a post that uses it extends the date), and
 * - uploads never finished within 48 hours (abandoned on a phone, closed tab).
 * Footage still needed by a post in review or on its way to YouTube is skipped. Runs even while YouTube Studio
 * is switched off: deleting old raw video is about privacy and storage, not publishing.
 */
import type { Payload, PayloadRequest } from 'payload'

import { retentionAction, STALE_UPLOAD_MS } from './segments'
import { deletePrefix, footageStorageProblems } from './storage'

/** Posts in these states still need their footage. */
const NEEDS_FOOTAGE = ['pending_review', 'approved', 'uploading', 'processing', 'failed']

export async function runFootageRetention(payload: Payload, now = new Date(), req?: PayloadRequest) {
  const result = { expired: 0, abandoned: 0, skipped: 0, errors: 0 }
  if (footageStorageProblems().length) return result
  const staleBefore = new Date(now.getTime() - STALE_UPLOAD_MS).toISOString()
  const due = await payload.find({
    collection: 'footage',
    where: {
      or: [
        { and: [{ uploadStatus: { equals: 'uploaded' } }, { retainUntil: { less_than_equal: now.toISOString() } }] },
        { and: [{ uploadStatus: { in: ['uploading', 'failed'] } }, { createdAt: { less_than: staleBefore } }] },
      ],
    },
    depth: 0,
    limit: 50,
    sort: 'createdAt',
    overrideAccess: true,
    req,
  })
  for (const doc of due.docs) {
    const action = retentionAction(doc, now)
    if (!action) continue
    try {
      if (action === 'expire') {
        const busy = await payload.count({
          collection: 'youtube-posts',
          where: { and: [{ footage: { equals: doc.id } }, { status: { in: NEEDS_FOOTAGE } }] },
          overrideAccess: true,
          req,
        })
        if (busy.totalDocs > 0) {
          result.skipped++
          continue
        }
      }
      if (doc.storagePrefix) await deletePrefix(doc.storagePrefix)
      await payload.update({
        collection: 'footage',
        id: doc.id,
        data: { uploadStatus: 'deleted', retainUntil: null },
        overrideAccess: true,
        req,
      })
      result[action === 'expire' ? 'expired' : 'abandoned']++
    } catch (err) {
      result.errors++
      payload.logger.error({ err }, `[footageRetention] footage ${doc.id} could not be cleaned up`)
    }
  }
  if (result.expired || result.abandoned || result.errors) payload.logger.info(`[footageRetention] ${JSON.stringify(result)}`)
  return result
}
