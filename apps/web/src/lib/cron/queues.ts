/**
 * Which job queue one POST /api/cron call runs (docs/api-contract.md §9).
 *
 * The plain call runs only the `default` queue: push sending, push receipts, breaking-news expiry and Payload's
 * scheduled publishing. Long-running work gets its own queue and its own cron entry, so it can never delay
 * those: `?queue=youtube` runs one YouTube Studio job per call.
 */
export const CRON_QUEUES = {
  /** Jobs per call. A push slice is ~5 Expo requests, so 10 stays well inside a normal request time. */
  default: { limit: 10 },
  /** One upload step per call; each step is time-boxed to ~60 s (Hostinger 120 s / Cloudflare ~100 s). */
  youtube: { limit: 1 },
} as const

export type CronQueue = keyof typeof CRON_QUEUES

export type CronPlan = { ok: true; queue: CronQueue; limit: number } | { ok: false; error: string }

/** Reads `?queue=` from the request. Missing or empty means `default`; unknown names are refused. */
export function cronPlan(queueParam: string | null | undefined): CronPlan {
  const name = (queueParam ?? '').trim() || 'default'
  if (!Object.prototype.hasOwnProperty.call(CRON_QUEUES, name)) {
    return { ok: false, error: `Unknown queue "${name.slice(0, 40)}".` }
  }
  const queue = name as CronQueue
  return { ok: true, queue, limit: CRON_QUEUES[queue].limit }
}
