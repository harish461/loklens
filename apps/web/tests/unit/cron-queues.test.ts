import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CRON_QUEUES, cronPlan } from '@/lib/cron/queues'

// The route only needs getPayload().jobs; the real config would connect to the database.
const jobs = { handleSchedules: vi.fn(), run: vi.fn() }
const logger = { error: vi.fn() }
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ jobs, logger })) }))

describe('cronPlan', () => {
  it('runs only the default queue when no queue is given', () => {
    expect(cronPlan(null)).toEqual({ ok: true, queue: 'default', limit: 10 })
    expect(cronPlan(undefined)).toEqual({ ok: true, queue: 'default', limit: 10 })
    expect(cronPlan('  ')).toEqual({ ok: true, queue: 'default', limit: 10 })
  })

  it('runs one job per call on the youtube queue', () => {
    expect(cronPlan('youtube')).toEqual({ ok: true, queue: 'youtube', limit: 1 })
  })

  it('refuses unknown queues and prototype keys', () => {
    for (const q of ['ai', 'YOUTUBE', 'all', 'constructor', '__proto__', 'toString']) {
      expect(cronPlan(q).ok).toBe(false)
    }
  })

  it('never offers an "all queues" mode', () => {
    expect(Object.keys(CRON_QUEUES).sort()).toEqual(['default', 'youtube'])
  })
})

describe('POST /api/cron', () => {
  const SECRET = 'test-cron-secret-0123456789'
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.stubEnv('CRON_SECRET', SECRET)
    jobs.handleSchedules.mockReset().mockResolvedValue(undefined)
    jobs.run.mockReset().mockResolvedValue({ noJobsRemaining: true })
    logger.error.mockReset()
    ;({ POST } = await import('@/app/api/cron/route'))
  })
  afterEach(() => vi.unstubAllEnvs())

  const call = (query = '', secret: string | null = SECRET) =>
    POST(new NextRequest(`http://localhost/api/cron${query}`, { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} }))

  it('rejects a missing or wrong secret without running anything', async () => {
    expect((await call('', null)).status).toBe(401)
    expect((await call('', 'wrong')).status).toBe(401)
    expect(jobs.run).not.toHaveBeenCalled()
  })

  it('plain call: schedules and runs the default queue only (push, expiry, scheduled publish)', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(jobs.handleSchedules).toHaveBeenCalledWith({ queue: 'default' })
    expect(jobs.run).toHaveBeenCalledWith({ queue: 'default', limit: 10 })
    const calls = [...jobs.handleSchedules.mock.calls, ...jobs.run.mock.calls].map((c) => c[0])
    expect(calls.some((arg) => 'allQueues' in arg)).toBe(false)
    expect((await res.json()).queue).toBe('default')
  })

  it('?queue=youtube runs one youtube job', async () => {
    const res = await call('?queue=youtube')
    expect(res.status).toBe(200)
    expect(jobs.handleSchedules).toHaveBeenCalledWith({ queue: 'youtube' })
    expect(jobs.run).toHaveBeenCalledWith({ queue: 'youtube', limit: 1 })
  })

  it('unknown queue → 400, nothing runs', async () => {
    const res = await call('?queue=everything')
    expect(res.status).toBe(400)
    expect(jobs.run).not.toHaveBeenCalled()
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('a failing job run → 500 without details', async () => {
    jobs.run.mockRejectedValueOnce(new Error('db down: secret-ish detail'))
    const res = await call()
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('db down')
  })
})
