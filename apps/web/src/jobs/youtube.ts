import type { TaskConfig } from 'payload'

import { runPublisherStep } from '../lib/youtube/publisher'

/**
 * YouTube publisher (lib/youtube/publisher.ts). Scheduled every minute on the `youtube` queue, which only
 * `POST /api/cron?queue=youtube` runs (1 job per call), so a long upload step never delays push or scheduled
 * publishing on the default queue. Does nothing unless YOUTUBE_STUDIO_ENABLED and the admin switch are on.
 */
export const youtubePublishTask: TaskConfig<{ input: Record<string, never>; output: { action: string; postId: number } }> = {
  slug: 'youtubePublish',
  label: 'YouTube publisher step',
  schedule: [{ cron: '* * * * *', queue: 'youtube' }],
  retries: 0,
  outputSchema: [
    { name: 'action', type: 'text', required: true },
    { name: 'postId', type: 'number', required: true },
  ],
  handler: async ({ req }) => {
    const r = await runPublisherStep(req.payload, { req })
    return { output: { action: r.action, postId: 'postId' in r ? r.postId : 0 } }
  },
}
