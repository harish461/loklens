import { afterEach, describe, expect, it, vi } from 'vitest'

import { youtubeMetadataProblems } from '@/access/youtube'
import { putChunk, queryUpload, YoutubeApiError } from '@/lib/youtube/api'
import {
  backoffMs,
  chunkBytes,
  CHUNK_UNIT,
  classifyError,
  fullDescription,
  istDayStart,
  offsetFromRange,
  pollDelayMs,
  safeError,
  videoResource,
  youtubeUrl,
} from '@/lib/youtube/publishPlan'

vi.mock('@/lib/google/oauth', () => ({ googleAccessToken: async () => 'test-token' }))

const NOW = new Date('2026-11-28T06:00:00.000Z')
const post = {
  postType: 'video',
  title: '  देहरादून में बारिश  ',
  description: 'विवरण',
  tags: ['dehradun', 'बारिश'],
  hashtags: ['#उत्तराखंड', '#Dehradun'],
  categoryId: '25',
  defaultLanguage: 'hi',
  privacyStatus: 'unlisted',
  publishAt: null,
  madeForKids: false,
  containsSyntheticMedia: false,
}

describe('videoResource', () => {
  it('always sends privacy explicitly, with metadata and hashtags at the end of the description', () => {
    expect(videoResource(post, NOW)).toEqual({
      snippet: {
        title: 'देहरादून में बारिश',
        description: 'विवरण\n\n#उत्तराखंड #Dehradun',
        tags: ['dehradun', 'बारिश'],
        categoryId: '25',
        defaultLanguage: 'hi',
        defaultAudioLanguage: 'hi',
      },
      status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false, containsSyntheticMedia: false, embeddable: true },
    })
  })

  it('a future schedule uploads as private with publishAt', () => {
    const r = videoResource({ ...post, privacyStatus: 'public', publishAt: '2026-11-29T12:00:00.000Z' }, NOW)
    expect(r.status).toMatchObject({ privacyStatus: 'private', publishAt: '2026-11-29T12:00:00.000Z' })
  })

  it('a schedule already in the past is ignored; unknown privacy falls back to unlisted, never public', () => {
    expect(videoResource({ ...post, privacyStatus: 'public', publishAt: '2026-11-28T05:00:00.000Z' }, NOW).status).toMatchObject({ privacyStatus: 'public' })
    expect(videoResource({ ...post, privacyStatus: null }, NOW).status.privacyStatus).toBe('unlisted')
    expect(videoResource({ ...post, privacyStatus: 'everyone' }, NOW).status.privacyStatus).toBe('unlisted')
  })

  it('description without hashtags / hashtags without description', () => {
    expect(fullDescription({ description: 'a', hashtags: [] })).toBe('a')
    expect(fullDescription({ description: '', hashtags: ['#x'] })).toBe('#x')
  })

  it('the 5000-byte limit counts the hashtag line too', () => {
    const description = 'क'.repeat(1660) // 4980 bytes
    expect(youtubeMetadataProblems({ description })).toEqual([])
    expect(youtubeMetadataProblems({ description, hashtags: ['#उत्तराखंड'] }).join()).toMatch(/with hashtags/)
  })
})

describe('small rules', () => {
  it('chunk size: multiple of 256 KiB, 8 MiB default, clamped', () => {
    expect(chunkBytes(undefined)).toBe(8 * 1024 * 1024)
    expect(chunkBytes('16')).toBe(16 * 1024 * 1024)
    expect(chunkBytes('0.1') % CHUNK_UNIT).toBe(0)
    expect(chunkBytes('500')).toBe(64 * 1024 * 1024)
  })
  it('offset from Range', () => {
    expect(offsetFromRange('bytes=0-1048575')).toBe(1048576)
    expect(offsetFromRange(null)).toBe(0)
  })
  it('urls', () => {
    expect(youtubeUrl('abcdefghijk', 'short')).toBe('https://www.youtube.com/shorts/abcdefghijk')
    expect(youtubeUrl('abcdefghijk', 'video')).toBe('https://www.youtube.com/watch?v=abcdefghijk')
  })
  it('India day start', () => {
    expect(istDayStart(new Date('2026-11-28T20:00:00Z')).toISOString()).toBe('2026-11-28T18:30:00.000Z')
    expect(istDayStart(new Date('2026-11-28T17:00:00Z')).toISOString()).toBe('2026-11-27T18:30:00.000Z')
  })
  it('error classes', () => {
    expect(classifyError(403, 'quotaExceeded')).toBe('quota')
    expect(classifyError(400, 'uploadLimitExceeded')).toBe('quota')
    expect(classifyError(401, null)).toBe('auth')
    expect(classifyError(404, null)).toBe('session')
    expect(classifyError(503, 'backendError')).toBe('retry')
    expect(classifyError(429, null)).toBe('retry')
    expect(classifyError(400, 'invalidTitle')).toBe('permanent')
    expect(classifyError(403, 'forbidden')).toBe('permanent')
  })
  it('backoff and polling', () => {
    expect([1, 2, 3, 6, 9].map((a) => backoffMs(a) / 60_000)).toEqual([1, 2, 4, 30, 30])
    expect(pollDelayMs(60_000)).toBe(2 * 60_000)
    expect(pollDelayMs(20 * 60_000)).toBe(5 * 60_000)
    expect(pollDelayMs(2 * 3600_000)).toBe(15 * 60_000)
  })
  it('errors never keep URLs or tokens', () => {
    const e = safeError('PUT https://www.googleapis.com/upload/youtube/v3/videos?upload_id=SECRET failed access_token=abc')
    expect(e).not.toMatch(/SECRET|abc|googleapis/)
  })
})

describe('upload protocol (fetch mocked)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('308 with Range → next offset; the Content-Range header is exact', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 308, headers: { range: 'bytes=0-262143' } }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await putChunk('https://upload.example/s', new Uint8Array(262144), 0, 1000000, 'video/mp4')
    expect(r).toEqual({ done: false, offset: 262144 })
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>)['Content-Range']).toBe('bytes 0-262143/1000000')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })

  it('200/201 → the video id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'abcdefghijk' }), { status: 200 })))
    expect(await queryUpload('https://upload.example/s', 10)).toEqual({ done: true, videoId: 'abcdefghijk' })
  })

  it('errors carry status and YouTube reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 })),
    )
    const err = await queryUpload('https://upload.example/s', 10).catch((e) => e)
    expect(err).toBeInstanceOf(YoutubeApiError)
    expect([err.status, err.reason]).toEqual([403, 'quotaExceeded'])
  })
})
