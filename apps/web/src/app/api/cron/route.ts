import { timingSafeEqual } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'

/**
 * Internal endpoint for an external scheduler (Hostinger cron, every minute). Hostinger stops the Node app
 * after 5 minutes without requests, and then jobs.autoRun stops too; this request wakes the app and runs the
 * due work: scheduled tasks (breaking-news expiry, push receipts), then queued jobs (push sending, scheduled
 * publishing). Auth: `x-cron-secret` header must equal CRON_SECRET. Not part of the public v1 API.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Jobs per call. A push slice is ~5 Expo requests, so this stays well inside a normal request time. */
const JOBS_PER_RUN = 10

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
  const payload = await getPayload({ config })
  try {
    await payload.jobs.handleSchedules({ allQueues: true })
    const result = await payload.jobs.run({ allQueues: true, limit: JOBS_PER_RUN })
    return json(200, { ok: true, ran: result })
  } catch (err) {
    payload.logger.error({ err }, '[cron] job run failed')
    return json(500, { error: { code: 'SERVER_ERROR', message: 'Job run failed.' } })
  }
}
