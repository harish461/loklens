import { describe, expect, it } from 'vitest'

import { parseRange } from '@/lib/footage/range'

const MB = 1024 * 1024

describe('parseRange', () => {
  it('no header → first chunk', () => expect(parseRange(null, 100 * MB, 4 * MB)).toEqual({ start: 0, end: 4 * MB - 1 }))
  it('open-ended → capped at the chunk size', () => expect(parseRange('bytes=10-', 100 * MB, 4 * MB)).toEqual({ start: 10, end: 10 + 4 * MB - 1 }))
  it('explicit range inside the file', () => expect(parseRange('bytes=5-9', 100, 4 * MB)).toEqual({ start: 5, end: 9 }))
  it('end past the file is clamped', () => expect(parseRange('bytes=90-500', 100, 4 * MB)).toEqual({ start: 90, end: 99 }))
  it('suffix range', () => expect(parseRange('bytes=-10', 100, 4 * MB)).toEqual({ start: 90, end: 99 }))
  it('small file without header', () => expect(parseRange(null, 50, 4 * MB)).toEqual({ start: 0, end: 49 }))
  it('invalid ranges', () => {
    for (const h of ['bytes=100-', 'bytes=9-5', 'bytes=-', 'items=0-5', 'bytes=0-5,10-20', 'bytes=-0']) {
      expect(parseRange(h, 100, 4 * MB)).toBe('invalid')
    }
    expect(parseRange(null, 0, 4 * MB)).toBe('invalid')
  })
})
