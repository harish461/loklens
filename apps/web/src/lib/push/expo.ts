/**
 * Client for Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/).
 * - send: at most 100 messages per request; returns one ticket per message, in order.
 * - receipts: at most 1000 ticket IDs per request; available ~15 minutes after sending.
 * Retries 429 and 5xx responses with exponential backoff. The optional EXPO_ACCESS_TOKEN (server-only) is
 * required once "Enhanced push security" is turned on for the Expo project.
 */
import type { ExpoMessage } from './rules'

const SEND_URL = 'https://exp.host/--/api/v2/push/send'
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts'

export const MAX_MESSAGES_PER_REQUEST = 100
export const MAX_RECEIPT_IDS_PER_REQUEST = 1000

export type PushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } }

export type PushReceipt = { status: 'ok' } | { status: 'error'; message: string; details?: { error?: string } }

export class ExpoPushError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ExpoPushError'
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  }
  const token = process.env.EXPO_ACCESS_TOKEN?.trim()
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

/** POST with up to 3 attempts (1 s, 2 s, 4 s backoff) on network errors, 429 and 5xx. */
async function postWithRetry(url: string, body: unknown, attempts = 3): Promise<unknown> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1))
    try {
      const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) })
      if (res.status === 429 || res.status >= 500) {
        lastError = new ExpoPushError(`Expo push service returned ${res.status}`, res.status)
        continue
      }
      const json = (await res.json().catch(() => null)) as { data?: unknown; errors?: { message?: string }[] } | null
      if (!res.ok || !json || json.errors?.length) {
        // 4xx (bad request, too many messages, wrong access token): not worth retrying.
        throw new ExpoPushError(json?.errors?.[0]?.message ?? `Expo push service returned ${res.status}`, res.status)
      }
      return json.data
    } catch (err) {
      if (err instanceof ExpoPushError && err.status >= 400 && err.status < 500 && err.status !== 429) throw err
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Expo push request failed')
}

/** Sends one batch (≤ 100 messages). Returns the tickets in message order. */
export async function sendPushBatch(messages: ExpoMessage[]): Promise<PushTicket[]> {
  if (messages.length === 0) return []
  if (messages.length > MAX_MESSAGES_PER_REQUEST) throw new Error(`At most ${MAX_MESSAGES_PER_REQUEST} messages per request`)
  const data = await postWithRetry(SEND_URL, messages)
  if (!Array.isArray(data) || data.length !== messages.length) {
    throw new ExpoPushError('Unexpected response from the Expo push service', 502)
  }
  return data as PushTicket[]
}

/** Looks up receipts for ≤ 1000 ticket IDs. IDs Expo does not know yet are simply missing from the result. */
export async function getPushReceipts(ids: string[]): Promise<Record<string, PushReceipt>> {
  if (ids.length === 0) return {}
  if (ids.length > MAX_RECEIPT_IDS_PER_REQUEST) throw new Error(`At most ${MAX_RECEIPT_IDS_PER_REQUEST} IDs per request`)
  const data = await postWithRetry(RECEIPTS_URL, { ids })
  return (data && typeof data === 'object' ? data : {}) as Record<string, PushReceipt>
}

/** Expo error codes that mean the token is dead and the device should stop being targeted. */
export function isDeadTokenError(code: string | undefined): boolean {
  return code === 'DeviceNotRegistered'
}
