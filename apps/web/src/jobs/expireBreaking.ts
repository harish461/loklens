import type { TaskConfig } from 'payload'

/**
 * Clears `isBreaking` on published articles whose `breakingUntil` has passed (architecture §4).
 * Scheduled every minute and executed by jobs.autoRun. Updates go through the normal hooks, so the
 * home page / article caches are revalidated (via /api/revalidate, since jobs run outside a request).
 */
export const expireBreakingTask: TaskConfig<{ input: Record<string, never>; output: { cleared: number } }> = {
  slug: 'expireBreaking',
  label: 'Expire breaking-news labels',
  schedule: [{ cron: '* * * * *', queue: 'default' }],
  retries: 0,
  outputSchema: [{ name: 'cleared', type: 'number', required: true }],
  handler: async ({ req }) => {
    const now = new Date().toISOString()
    const expired = await req.payload.find({
      collection: 'articles',
      where: {
        and: [
          { isBreaking: { equals: true } },
          { breakingUntil: { less_than_equal: now } },
          { _status: { equals: 'published' } },
        ],
      },
      depth: 0,
      limit: 100,
      pagination: false,
      overrideAccess: true,
      req,
    })
    let cleared = 0
    for (const doc of expired.docs) {
      await req.payload.update({
        collection: 'articles',
        id: doc.id,
        data: { isBreaking: false },
        depth: 0,
        overrideAccess: true,
        req,
      })
      cleared++
    }
    if (cleared > 0) req.payload.logger.info(`[expireBreaking] cleared ${cleared} article(s)`)
    return { output: { cleared } }
  },
}
