/**
 * Sending side of push notifications (api-contract §8). Runs inside Payload jobs (jobs/push.ts), never in a
 * reader's request:
 * - sendNotificationSlice: sends one slice (≤ SLICE_SIZE devices) of a notification and tells the job whether
 *   more slices remain, so a large audience never needs one long-running request (Hostinger stops idle apps
 *   and proxies cut long requests).
 * - checkReceipts: looks up Expo receipts for accepted tickets older than 15 minutes and deactivates devices
 *   whose token is dead.
 * Counters are incremented in SQL so the two jobs never overwrite each other's numbers.
 */
import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { getPushReceipts, isDeadTokenError, MAX_MESSAGES_PER_REQUEST, MAX_RECEIPT_IDS_PER_REQUEST, sendPushBatch } from './expo'
import { buildMessage, chunk, normalizeStoredPreferences, wantsNotification, type MessageInput, type TargetSpec } from './rules'

/** Devices read per slice. 5 Expo requests of 100: well inside a job run. */
export const SLICE_SIZE = 500
/** Expo keeps receipts for a day and publishes them within ~15 minutes. */
const RECEIPT_DELAY_MS = 15 * 60 * 1000
const RECEIPTS_PER_RUN = 3000

type Counter = 'targeted' | 'accepted' | 'failed' | 'handedOver' | 'receiptFailed' | 'opened'
const COUNTER_COLUMNS: Record<Counter, string> = {
  targeted: 'targeted',
  accepted: 'accepted',
  failed: 'failed',
  handedOver: 'handed_over',
  receiptFailed: 'receipt_failed',
  opened: 'opened',
}

/** Atomically adds to the notification's counters (column names come from the fixed map above). */
export async function incrementCounters(payload: Payload, notificationId: number, delta: Partial<Record<Counter, number>>): Promise<void> {
  const parts = Object.entries(delta)
    .filter(([, n]) => typeof n === 'number' && n !== 0)
    .map(([key, n]) => sql`${sql.identifier(COUNTER_COLUMNS[key as Counter])} = coalesce(${sql.identifier(COUNTER_COLUMNS[key as Counter])}, 0) + ${n}`)
  if (parts.length === 0) return
  await payload.db.drizzle.execute(sql`UPDATE "push_notifications" SET ${sql.join(parts, sql`, `)} WHERE "id" = ${notificationId}`)
}

const idOf = (value: unknown): number | null => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) return Number((value as { id: unknown }).id)
  return null
}

export interface SliceResult {
  done: boolean
  sentTo: number
  /** Another runner held the notification; a follow-up job was queued for when its lease ends. */
  busy?: boolean
}

/**
 * Sends the next slice of a notification. Idempotent per slice: the cursor (last device ID handled) is saved
 * after each slice, so a retried job continues where it stopped instead of re-sending.
 */
export async function sendNotificationSlice(payload: Payload, notificationId: number, req?: PayloadRequest): Promise<SliceResult> {
  // Claim the notification first: if another job runner is already sending it, step aside and look again
  // once its lease has run out (by then it has finished, or crashed and left the rest to us).
  if (!(await claimLease(payload, notificationId))) {
    await payload.jobs.queue({ task: 'pushSend', input: { notificationId }, waitUntil: new Date(Date.now() + LEASE_MS + 5_000), req })
    return { done: true, sentTo: 0, busy: true }
  }
  try {
    return await sendClaimedSlice(payload, notificationId, req)
  } finally {
    await releaseLease(payload, notificationId)
  }
}

/** How long a runner may hold a notification. A slice (≤ 5 Expo requests with retries) ends well before. */
export const LEASE_MS = 3 * 60 * 1000

/** Atomic in Postgres: only one runner gets the row while the lease is live. */
export async function claimLease(payload: Payload, notificationId: number): Promise<boolean> {
  const res = (await payload.db.drizzle.execute(sql`
    UPDATE "push_notifications"
    SET "lease_until" = now() + make_interval(secs => ${LEASE_MS / 1000})
    WHERE "id" = ${notificationId} AND ("lease_until" IS NULL OR "lease_until" < now())
    RETURNING "id"`)) as { rows: unknown[] }
  return res.rows.length === 1
}

async function releaseLease(payload: Payload, notificationId: number): Promise<void> {
  await payload.db.drizzle.execute(sql`UPDATE "push_notifications" SET "lease_until" = NULL WHERE "id" = ${notificationId}`)
}

async function sendClaimedSlice(payload: Payload, notificationId: number, req?: PayloadRequest): Promise<SliceResult> {
  const n = await payload.findByID({ collection: 'push-notifications', id: notificationId, depth: 1, overrideAccess: true, req }).catch(() => null)
  if (!n) return { done: true, sentTo: 0 }
  if (n.status === 'sent' || n.status === 'cancelled' || n.status === 'failed') return { done: true, sentTo: 0 }

  if (n.status !== 'sending') {
    await payload.update({ collection: 'push-notifications', id: n.id, data: { status: 'sending' }, overrideAccess: true, req })
  }

  const article = n.article && typeof n.article === 'object' ? n.article : null
  const categoryId = idOf(n.category) ?? idOf(article?.category)
  const categorySlug =
    n.category && typeof n.category === 'object' ? n.category.slug : article?.category && typeof article.category === 'object' ? article.category.slug : null
  const spec: TargetSpec = { type: n.type, audience: n.audience, categoryId }
  const message: MessageInput = {
    notificationId: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    imageUrl: n.imageUrl,
    articleId: article?.id ?? null,
    articleSlug: article?.slug ?? null,
    categorySlug: categorySlug ?? null,
  }

  const cursor = n.cursor ?? 0
  const page = await payload.find({
    collection: 'push-devices',
    where: { and: [{ active: { equals: true } }, { id: { greater_than: cursor } }] },
    sort: 'id',
    limit: SLICE_SIZE,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })

  let sentTo = 0
  // Work in groups of 100 stored devices and save the cursor after each, so a retry repeats at most one group.
  for (const group of chunk(page.docs, MAX_MESSAGES_PER_REQUEST)) {
    const batch = group.filter((d) => wantsNotification(normalizeStoredPreferences(d.preferences), spec))
    const { accepted, failed } = await sendBatch(payload, n.id, message, batch, req)
    sentTo += batch.length
    await incrementCounters(payload, n.id, { targeted: batch.length, accepted, failed })
    await payload.update({ collection: 'push-notifications', id: n.id, data: { cursor: group[group.length - 1].id }, overrideAccess: true, req })
  }

  const done = page.docs.length < SLICE_SIZE
  if (done) {
    await payload.update({
      collection: 'push-notifications',
      id: n.id,
      data: { status: 'sent', sentAt: new Date().toISOString() },
      overrideAccess: true,
      req,
    })
  }
  return { done, sentTo }
}

/** Sends one Expo request (≤ 100 devices) and records a delivery row per device. */
async function sendBatch(
  payload: Payload,
  notificationId: number,
  message: MessageInput,
  batch: { id: number; token: string }[],
  req?: PayloadRequest,
): Promise<{ accepted: number; failed: number }> {
  let accepted = 0
  let failed = 0
  const n = { id: notificationId }
  if (batch.length === 0) return { accepted, failed }
  {
    let tickets
    try {
      tickets = await sendPushBatch(batch.map((d) => buildMessage(d.token, message)))
    } catch (err) {
      // The whole request failed after retries: record every message in it as failed and carry on.
      const msg = err instanceof Error ? err.message : String(err)
      payload.logger.error(`[push] send failed for notification ${n.id}: ${msg}`)
      for (const d of batch) {
        await payload.create({
          collection: 'push-deliveries',
          data: { notification: n.id, device: d.id, status: 'ticket_error', errorCode: 'RequestFailed', errorMessage: msg.slice(0, 300) },
          overrideAccess: true,
          req,
        })
      }
      failed += batch.length
      return { accepted, failed }
    }
    for (let i = 0; i < batch.length; i++) {
      const ticket = tickets[i]
      const device = batch[i]
      if (ticket.status === 'ok') {
        accepted++
        await payload.create({
          collection: 'push-deliveries',
          data: { notification: n.id, device: device.id, ticketId: ticket.id, status: 'accepted' },
          overrideAccess: true,
          req,
        })
      } else {
        failed++
        const code = ticket.details?.error ?? 'Error'
        await payload.create({
          collection: 'push-deliveries',
          data: { notification: n.id, device: device.id, status: 'ticket_error', errorCode: code, errorMessage: ticket.message?.slice(0, 300) },
          overrideAccess: true,
          req,
        })
        if (isDeadTokenError(code)) await deactivateDevice(payload, device.id, code, req)
      }
    }
  }
  return { accepted, failed }
}

export async function deactivateDevice(payload: Payload, deviceId: number, reason: string, req?: PayloadRequest): Promise<void> {
  await payload.update({
    collection: 'push-devices',
    id: deviceId,
    data: { active: false, deactivatedReason: reason },
    overrideAccess: true,
    req,
  })
}

/** Checks receipts for accepted tickets older than 15 minutes. Returns how many tickets were resolved. */
export async function checkReceipts(payload: Payload, req?: PayloadRequest): Promise<number> {
  const olderThan = new Date(Date.now() - RECEIPT_DELAY_MS).toISOString()
  const pending = await payload.find({
    collection: 'push-deliveries',
    where: { and: [{ status: { equals: 'accepted' } }, { ticketId: { exists: true } }, { createdAt: { less_than: olderThan } }] },
    sort: 'createdAt',
    limit: RECEIPTS_PER_RUN,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  let resolved = 0
  for (const batch of chunk(pending.docs, MAX_RECEIPT_IDS_PER_REQUEST)) {
    const receipts = await getPushReceipts(batch.map((d) => d.ticketId as string))
    const perNotification = new Map<number, { handedOver: number; receiptFailed: number }>()
    for (const delivery of batch) {
      const receipt = receipts[delivery.ticketId as string]
      if (!receipt) continue // not ready yet; try on the next run
      const notificationId = idOf(delivery.notification) as number
      const counts = perNotification.get(notificationId) ?? { handedOver: 0, receiptFailed: 0 }
      if (receipt.status === 'ok') {
        counts.handedOver++
        await payload.update({
          collection: 'push-deliveries',
          id: delivery.id,
          data: { status: 'receipt_ok', receiptCheckedAt: new Date().toISOString() },
          overrideAccess: true,
          req,
        })
      } else {
        counts.receiptFailed++
        const code = receipt.details?.error ?? 'Error'
        await payload.update({
          collection: 'push-deliveries',
          id: delivery.id,
          data: { status: 'receipt_error', errorCode: code, errorMessage: receipt.message?.slice(0, 300), receiptCheckedAt: new Date().toISOString() },
          overrideAccess: true,
          req,
        })
        if (isDeadTokenError(code)) await deactivateDevice(payload, idOf(delivery.device) as number, code, req)
      }
      perNotification.set(notificationId, counts)
      resolved++
    }
    for (const [notificationId, counts] of perNotification) await incrementCounters(payload, notificationId, counts)
  }
  return resolved
}
