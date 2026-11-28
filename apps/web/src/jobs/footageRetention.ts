import type { TaskConfig } from 'payload'

import { runFootageRetention } from '../lib/footage/retention'

/**
 * Deletes expired and abandoned footage segments from the private bucket (lib/footage/retention.ts).
 * Hourly on the default queue (POST /api/cron runs it); at most 50 rows per run.
 */
export const footageRetentionTask: TaskConfig<{
  input: Record<string, never>
  output: { expired: number; abandoned: number; skipped: number; errors: number }
}> = {
  slug: 'footageRetention',
  label: 'Delete old footage',
  schedule: [{ cron: '17 * * * *', queue: 'default' }],
  retries: 0,
  outputSchema: [
    { name: 'expired', type: 'number', required: true },
    { name: 'abandoned', type: 'number', required: true },
    { name: 'skipped', type: 'number', required: true },
    { name: 'errors', type: 'number', required: true },
  ],
  handler: async ({ req }) => ({ output: await runFootageRetention(req.payload, new Date(), req) }),
}
