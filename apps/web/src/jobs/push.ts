import type { TaskConfig } from 'payload'

import { checkReceipts, sendNotificationSlice } from '../lib/push/send'

/**
 * Push notification jobs (lib/push/send.ts). Both run through jobs.autoRun while the app is up, and through
 * POST /api/v1/push/cron, which a Hostinger cron job calls every minute so they also run after the host has
 * stopped the idle app.
 */

/** Sends one slice of a notification; queues itself again until every device has been handled. */
export const pushSendTask: TaskConfig<{ input: { notificationId: number }; output: { done: boolean; sentTo: number } }> = {
  slug: 'pushSend',
  label: 'Send push notification',
  inputSchema: [{ name: 'notificationId', type: 'number', required: true }],
  outputSchema: [
    { name: 'done', type: 'checkbox', required: true },
    { name: 'sentTo', type: 'number', required: true },
  ],
  // A retry continues from the saved cursor, so at most one batch of 100 can be sent twice.
  retries: 2,
  handler: async ({ input, req }) => {
    const result = await sendNotificationSlice(req.payload, input.notificationId, req)
    if (!result.done) {
      await req.payload.jobs.queue({ task: 'pushSend', input: { notificationId: input.notificationId }, req })
    }
    return { output: result }
  },
}

/** Resolves Expo receipts for tickets older than 15 minutes; deactivates dead tokens. */
export const pushReceiptsTask: TaskConfig<{ input: Record<string, never>; output: { resolved: number } }> = {
  slug: 'pushReceipts',
  label: 'Check push receipts',
  schedule: [{ cron: '*/5 * * * *', queue: 'default' }],
  retries: 0,
  outputSchema: [{ name: 'resolved', type: 'number', required: true }],
  handler: async ({ req }) => {
    const resolved = await checkReceipts(req.payload, req)
    if (resolved > 0) req.payload.logger.info(`[push] resolved ${resolved} receipt(s)`)
    return { output: { resolved } }
  },
}
