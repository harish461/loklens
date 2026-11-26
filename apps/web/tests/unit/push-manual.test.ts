import { describe, expect, it } from 'vitest'

import { manualDedupeKey, validateManualNotification } from '../../src/lib/push/manual'

const NOW = new Date('2026-11-26T10:00:00.000Z')
const base = { title: 'बड़ी खबर', body: 'विवरण', type: 'general', audience: 'all', idempotencyKey: 'abcd1234-ef56' }

describe('validateManualNotification', () => {
  it('accepts a minimal general notification sent now', () => {
    const r = validateManualNotification(base, NOW)
    expect(r).toEqual({
      ok: true,
      value: { title: 'बड़ी खबर', body: 'विवरण', imageUrl: null, type: 'general', audience: 'all', categoryId: null, articleId: null, scheduledAt: null, idempotencyKey: 'abcd1234-ef56' },
    })
  })

  it('requires title and message within limits', () => {
    const r = validateManualNotification({ ...base, title: ' ', body: 'x'.repeat(241) }, NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors).toEqual(['Add a title.', 'Keep the message under 240 characters.'])
  })

  it('only allows https image URLs', () => {
    expect(validateManualNotification({ ...base, imageUrl: 'http://x.com/a.png' }, NOW).ok).toBe(false)
    expect(validateManualNotification({ ...base, imageUrl: 'not a url' }, NOW).ok).toBe(false)
    const ok = validateManualNotification({ ...base, imageUrl: 'https://loklensnews.com/a.webp' }, NOW)
    expect(ok.ok && ok.value.imageUrl).toBe('https://loklensnews.com/a.webp')
  })

  it('rejects unknown type or audience values', () => {
    expect(validateManualNotification({ ...base, type: 'spam' }, NOW).ok).toBe(false)
    expect(validateManualNotification({ ...base, audience: 'everyone' }, NOW).ok).toBe(false)
  })

  it('needs a category for category subscribers and an article for article notifications', () => {
    expect(validateManualNotification({ ...base, audience: 'category' }, NOW).ok).toBe(false)
    expect(validateManualNotification({ ...base, audience: 'category', categoryId: '3' }, NOW).ok).toBe(true)
    expect(validateManualNotification({ ...base, type: 'article' }, NOW).ok).toBe(false)
    expect(validateManualNotification({ ...base, type: 'article', articleId: 51 }, NOW).ok).toBe(true)
  })

  it('schedules only between 1 minute and 30 days ahead', () => {
    expect(validateManualNotification({ ...base, scheduledAt: '2026-11-26T10:00:30.000Z' }, NOW).ok).toBe(false)
    expect(validateManualNotification({ ...base, scheduledAt: '2027-01-30T10:00:00.000Z' }, NOW).ok).toBe(false)
    expect(validateManualNotification({ ...base, scheduledAt: 'tomorrow' }, NOW).ok).toBe(false)
    const ok = validateManualNotification({ ...base, scheduledAt: '2026-11-26T12:30:00.000Z' }, NOW)
    expect(ok.ok && ok.value.scheduledAt).toBe('2026-11-26T12:30:00.000Z')
  })

  it('requires a well-formed idempotency key and builds the dedupe key from it', () => {
    expect(validateManualNotification({ ...base, idempotencyKey: '' }, NOW).ok).toBe(false)
    expect(validateManualNotification({ ...base, idempotencyKey: 'a; drop table' }, NOW).ok).toBe(false)
    expect(manualDedupeKey('abcd1234-ef56')).toBe('manual:abcd1234-ef56')
  })
})
