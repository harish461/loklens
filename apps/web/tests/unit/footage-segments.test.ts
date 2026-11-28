import { describe, expect, it } from 'vitest'

import {
  cleanFilename,
  cleanVideoFacts,
  detectContainer,
  missingSegments,
  retentionAction,
  segmentCount,
  segmentKey,
  segmentLength,
  segmentNumber,
  SEGMENT_BYTES,
  STALE_UPLOAD_MS,
  validateStart,
} from '@/lib/footage/segments'

const MB = 1024 * 1024

describe('segments', () => {
  it('45 MiB, a multiple of 256 KiB and under the 50 MB object cap', () => {
    expect(SEGMENT_BYTES).toBe(45 * MB)
    expect(SEGMENT_BYTES % (256 * 1024)).toBe(0)
    expect(SEGMENT_BYTES).toBeLessThan(50 * 1000 * 1000)
  })

  it('counts and sizes', () => {
    expect(segmentCount(1)).toBe(1)
    expect(segmentCount(SEGMENT_BYTES)).toBe(1)
    expect(segmentCount(SEGMENT_BYTES + 1)).toBe(2)
    const size = 2 * SEGMENT_BYTES + 123
    expect(segmentCount(size)).toBe(3)
    expect([1, 2, 3].map((n) => segmentLength(size, n))).toEqual([SEGMENT_BYTES, SEGMENT_BYTES, 123])
    expect(segmentLength(size, 4)).toBe(0)
  })

  it('keys round-trip', () => {
    expect(segmentKey('footage/7-ab', 3)).toBe('footage/7-ab/seg-0003')
    expect(segmentNumber('footage/7-ab/seg-0003')).toBe(3)
    expect(segmentNumber('footage/7-ab/manifest.json')).toBeNull()
  })

  it('missing segments: absent or wrong size', () => {
    const size = 2 * SEGMENT_BYTES + 10
    const stored = new Map([
      [segmentKey('p', 1), SEGMENT_BYTES],
      [segmentKey('p', 2), 5], // truncated upload
    ])
    expect(missingSegments('p', size, stored)).toEqual([2, 3])
    stored.set(segmentKey('p', 2), SEGMENT_BYTES).set(segmentKey('p', 3), 10)
    expect(missingSegments('p', size, stored)).toEqual([])
  })
})

describe('validateStart', () => {
  const ok = { filename: 'clip.mp4', sizeBytes: 100 * MB, mimeType: 'video/mp4', title: 'बारिश', rightsConfirmed: true }

  it('accepts a normal request', () => {
    expect(validateStart(ok, 2048 * MB)).toEqual({ ok: true, value: { filename: 'clip.mp4', sizeBytes: 100 * MB, mimeType: 'video/mp4', title: 'बारिश' } })
  })

  it('falls back to the extension when the browser gives no type', () => {
    const r = validateStart({ ...ok, filename: 'a.MOV', mimeType: '' }, 2048 * MB)
    expect(r.ok && r.value.mimeType).toBe('video/quicktime')
  })

  it('refuses: too big, empty, wrong type, no title, rights not confirmed', () => {
    const bad = (x: object) => validateStart({ ...ok, ...x }, 2048 * MB)
    expect(bad({ sizeBytes: 2049 * MB }).ok).toBe(false)
    expect(bad({ sizeBytes: 0 }).ok).toBe(false)
    expect(bad({ sizeBytes: '5' }).ok).toBe(false)
    expect(bad({ filename: 'a.avi', mimeType: 'video/x-msvideo' }).ok).toBe(false)
    expect(bad({ filename: 'a.exe', mimeType: 'application/octet-stream' }).ok).toBe(false)
    expect(bad({ title: '  ' }).ok).toBe(false)
    expect(bad({ rightsConfirmed: 'true' }).ok).toBe(false)
  })

  it('cleans file names', () => {
    expect(cleanFilename('C:\\Users\\x\\वीडियो<1>.mp4')).toBe('वीडियो1.mp4')
    expect(cleanFilename('../../etc/passwd')).toBe('passwd')
    expect(cleanFilename(undefined)).toBe('video')
  })
})

describe('detectContainer', () => {
  const bytes = (...b: number[]) => Uint8Array.from(b)
  const ftyp = (brand: string) => bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, ...[...brand].map((c) => c.charCodeAt(0)))

  it('MP4, MOV and WebM by their magic bytes', () => {
    expect(detectContainer(ftyp('isom'))).toBe('mp4')
    expect(detectContainer(ftyp('mp42'))).toBe('mp4')
    expect(detectContainer(ftyp('qt  '))).toBe('mov')
    expect(detectContainer(bytes(0x1a, 0x45, 0xdf, 0xa3, 0, 0))).toBe('webm')
  })

  it('anything else is refused', () => {
    expect(detectContainer(new TextEncoder().encode('MZ\x90\x00 this is an exe'))).toBeNull()
    expect(detectContainer(bytes(0xff, 0xd8, 0xff))).toBeNull()
    expect(detectContainer(new Uint8Array())).toBeNull()
  })
})

describe('cleanVideoFacts', () => {
  it('keeps sensible values and drops nonsense', () => {
    expect(cleanVideoFacts({ durationSeconds: 95.4321, width: 1920, height: 1080 })).toEqual({ durationSeconds: 95.4, width: 1920, height: 1080 })
    expect(cleanVideoFacts({ durationSeconds: Infinity, width: -1, height: 'x' })).toEqual({ durationSeconds: null, width: null, height: null })
  })
})

describe('retentionAction', () => {
  const now = new Date('2026-12-31T00:00:00Z')
  it('expires uploaded footage after retainUntil', () => {
    expect(retentionAction({ uploadStatus: 'uploaded', retainUntil: '2026-12-30T00:00:00Z' }, now)).toBe('expire')
    expect(retentionAction({ uploadStatus: 'uploaded', retainUntil: '2027-01-30T00:00:00Z' }, now)).toBeNull()
    expect(retentionAction({ uploadStatus: 'uploaded', retainUntil: null }, now)).toBeNull()
  })
  it('abandons unfinished uploads after 48 hours', () => {
    const old = new Date(now.getTime() - STALE_UPLOAD_MS - 1000).toISOString()
    const fresh = new Date(now.getTime() - 1000).toISOString()
    expect(retentionAction({ uploadStatus: 'uploading', createdAt: old }, now)).toBe('abandon')
    expect(retentionAction({ uploadStatus: 'failed', createdAt: old }, now)).toBe('abandon')
    expect(retentionAction({ uploadStatus: 'uploading', createdAt: fresh }, now)).toBeNull()
  })
  it('never touches deleted rows', () => {
    expect(retentionAction({ uploadStatus: 'deleted', retainUntil: '2020-01-01' }, now)).toBeNull()
  })
})
