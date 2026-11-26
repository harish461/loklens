/**
 * Creating and cancelling manual notifications (used by the admin server actions in
 * lib/admin/notificationActions.ts, which check the admin role first; also run by scripts/verify-push.ts).
 */
import type { Payload } from 'payload'

import { manualDedupeKey, type ManualNotification } from './manual'

export type CreateManualResult = { ok: true; id: number; scheduled: boolean; reused: boolean } | { ok: false; errors: string[] }

/**
 * Creates the notification and queues `pushSend`. "Send now" also runs the first slice straight away so readers
 * get it without waiting for the next job pass; scheduled ones wait for their time (job `waitUntil`).
 * A second call with the same form key returns the existing notification instead of sending twice.
 */
export async function createManualNotification(payload: Payload, createdBy: number, v: ManualNotification): Promise<CreateManualResult> {
  const dedupeKey = manualDedupeKey(v.idempotencyKey)
  const existing = await payload.find({ collection: 'push-notifications', where: { dedupeKey: { equals: dedupeKey } }, limit: 1, depth: 0, overrideAccess: true })
  if (existing.docs[0]) return { ok: true, id: existing.docs[0].id, scheduled: Boolean(existing.docs[0].scheduledAt), reused: true }

  if (v.articleId) {
    const article = await payload.findByID({ collection: 'articles', id: v.articleId, depth: 0, overrideAccess: true }).catch(() => null)
    if (!article || article._status !== 'published') return { ok: false, errors: ['Choose a published article.'] }
  }
  if (v.categoryId) {
    const category = await payload.findByID({ collection: 'categories', id: v.categoryId, depth: 0, overrideAccess: true }).catch(() => null)
    if (!category) return { ok: false, errors: ['Choose an existing category.'] }
  }

  const doc = await payload.create({
    collection: 'push-notifications',
    data: {
      title: v.title,
      body: v.body,
      imageUrl: v.imageUrl,
      type: v.type,
      audience: v.audience,
      category: v.categoryId,
      article: v.articleId,
      source: 'manual',
      dedupeKey,
      status: v.scheduledAt ? 'scheduled' : 'queued',
      scheduledAt: v.scheduledAt,
      createdBy,
    },
    overrideAccess: true,
  })
  const job = await payload.jobs.queue({
    task: 'pushSend',
    input: { notificationId: doc.id },
    ...(v.scheduledAt ? { waitUntil: new Date(v.scheduledAt) } : {}),
  })
  if (!v.scheduledAt) {
    // Start now; if this fails the queued job still runs on the next job pass.
    await payload.jobs.runByID({ id: job.id }).catch((err) => payload.logger.error({ err }, `[push] immediate send failed for ${doc.id}`))
  }
  return { ok: true, id: doc.id, scheduled: Boolean(v.scheduledAt), reused: false }
}

/** Cancels a notification that has not started sending (its queued job then does nothing). */
export async function cancelManualNotification(payload: Payload, id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const doc = await payload.findByID({ collection: 'push-notifications', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!doc) return { ok: false, error: 'Notification not found.' }
  if (doc.status !== 'scheduled' && doc.status !== 'queued') return { ok: false, error: 'Only notifications that have not started sending can be cancelled.' }
  await payload.update({ collection: 'push-notifications', id: doc.id, data: { status: 'cancelled' }, overrideAccess: true })
  return { ok: true }
}
