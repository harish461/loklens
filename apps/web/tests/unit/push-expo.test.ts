/** Expo push client (lib/push/expo.ts) against a fake fetch: batching limits, retries, error handling. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpoPushError, getPushReceipts, isDeadTokenError, sendPushBatch } from '../../src/lib/push/expo'
import { buildMessage } from '../../src/lib/push/rules'

const msg = (i: number) => buildMessage(`ExponentPushToken[token-${String(i).padStart(10, '0')}]`, { notificationId: 1, type: 'general', title: 't', body: 'b' })
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete process.env.EXPO_ACCESS_TOKEN
})

describe('sendPushBatch', () => {
  it('returns one ticket per message and sends the access token when set', async () => {
    process.env.EXPO_ACCESS_TOKEN = 'secret-token'
    fetchMock.mockResolvedValueOnce(response(200, { data: [{ status: 'ok', id: 'a' }, { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }] }))
    const tickets = await sendPushBatch([msg(1), msg(2)])
    expect(tickets).toEqual([{ status: 'ok', id: 'a' }, { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://exp.host/--/api/v2/push/send')
    expect(init.headers.Authorization).toBe('Bearer secret-token')
    expect(JSON.parse(init.body)).toHaveLength(2)
  })

  it('refuses more than 100 messages in one request', async () => {
    await expect(sendPushBatch(Array.from({ length: 101 }, (_, i) => msg(i)))).rejects.toThrow(/100/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retries 429 and 5xx with backoff, then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(response(429, { errors: [{ message: 'slow down' }] }))
      .mockResolvedValueOnce(response(503, {}))
      .mockResolvedValueOnce(response(200, { data: [{ status: 'ok', id: 'x' }] }))
    const promise = sendPushBatch([msg(1)])
    await vi.runAllTimersAsync()
    await expect(promise).resolves.toEqual([{ status: 'ok', id: 'x' }])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry other 4xx errors', async () => {
    fetchMock.mockResolvedValue(response(401, { errors: [{ message: 'bad access token' }] }))
    await expect(sendPushBatch([msg(1)])).rejects.toBeInstanceOf(ExpoPushError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after 3 attempts on repeated server errors', async () => {
    fetchMock.mockResolvedValue(response(500, {}))
    const promise = sendPushBatch([msg(1)])
    const assertion = expect(promise).rejects.toThrow(/500/)
    await vi.runAllTimersAsync()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('rejects a response whose ticket count does not match', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { data: [] }))
    await expect(sendPushBatch([msg(1)])).rejects.toThrow(/Unexpected/)
  })
})

describe('getPushReceipts', () => {
  it('posts the ticket IDs and returns the receipts map', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { data: { a: { status: 'ok' } } }))
    await expect(getPushReceipts(['a', 'b'])).resolves.toEqual({ a: { status: 'ok' } })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ids: ['a', 'b'] })
  })
  it('makes no request for an empty list and refuses more than 1000 IDs', async () => {
    await expect(getPushReceipts([])).resolves.toEqual({})
    await expect(getPushReceipts(Array.from({ length: 1001 }, (_, i) => String(i)))).rejects.toThrow(/1000/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('isDeadTokenError', () => {
  it('only DeviceNotRegistered retires a token', () => {
    expect(isDeadTokenError('DeviceNotRegistered')).toBe(true)
    expect(isDeadTokenError('MessageRateExceeded')).toBe(false)
    expect(isDeadTokenError(undefined)).toBe(false)
  })
})
