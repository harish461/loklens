import { timingSafeEqual } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { cronPlan } from '@/lib/cron/queues'

/**
 * Internal endpoint for an external scheduler (Hostinger cron, every minute). Hostinger stops the Node app
 * after 5 minutes without requests, and then jobs.autoRun stops too; this request wakes the app and runs the
 * due work for ONE queue: its scheduled tasks, then its queued jobs.
 *   POST /api/cron                → queue "default" (push sending and receipts, breaking-news expiry,
 *                                   scheduled publishing), up to 10 jobs
 *   POST /api/cron?queue=youtube  → queue "youtube" (YouTube Studio uploads), 1 job per call
 * Auth: `x-cron-secret` header must equal CRON_SECRET. Not part of the public v1 API (api-contract.md §9).
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function secretMatches(given: string | null): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get('x-cron-secret'))) {
    return json(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid secret.' } })
  }
  const plan = cronPlan(req.nextUrl.searchParams.get('queue'))
  if (!plan.ok) return json(400, { error: { code: 'BAD_REQUEST', message: plan.error } })

  const payload = await getPayload({ config })
  try {
    await payload.jobs.handleSchedules({ queue: plan.queue })
    const result = await payload.jobs.run({ queue: plan.queue, limit: plan.limit })
    return json(200, { ok: true, queue: plan.queue, ran: result })
  } catch (err) {
    payload.logger.error({ err }, `[cron] job run failed (queue ${plan.queue})`)
    return json(500, { error: { code: 'SERVER_ERROR', message: 'Job run failed.' } })
  }
}
