import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatRelative } from '@/components/format'
import {
  decodeXmlEntities,
  fetchYouTubeLatest,
  isShortsLink,
  parseYouTubeFeed,
  toISTString,
  trimText,
} from '@/lib/social/youtube'

// Synthetic fixture in the shape of https://www.youtube.com/feeds/videos.xml?channel_id=…
const entry = (id: string, title: string, published: string, link = `https://www.youtube.com/watch?v=${id}`) => `
 <entry>
  <id>yt:video:${id}</id>
  <yt:videoId>${id}</yt:videoId>
  <yt:channelId>UCQ9BfhKRBEESTPyscj1JmCg</yt:channelId>
  <title>${title}</title>
  <link rel="alternate" href="${link}"/>
  <author><name>LokLens News</name></author>
  <published>${published}</published>
  <updated>${published}</updated>
  <media:group>
   <media:title>${title}</media:title>
   <media:thumbnail url="https://i1.ytimg.com/vi/${id}/hqdefault.jpg" width="480" height="360"/>
  </media:group>
 </entry>`

const feed = (...entries: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>LokLens News</title>
 ${entries.join('\n')}
</feed>`

const FIXTURE = feed(
  entry('AAAAAAAAAA1', '[पहला वीडियो] &amp; धामी &quot;संवाद&quot;', '2026-11-08T10:00:00+00:00'),
  entry('AAAAAAAAAA2', '[सबसे नया वीडियो]', '2026-11-09T05:39:48+00:00', 'https://www.youtube.com/shorts/AAAAAAAAAA2'),
  entry('AAAAAAAAAA3', '[तीसरा]', '2026-11-07T10:00:00+00:00'),
  entry('AAAAAAAAAA4', '[चौथा]', '2026-11-06T10:00:00+00:00'),
  entry('bad id', '[अमान्य id]', '2026-11-10T10:00:00+00:00'),
  entry('AAAAAAAAAA5', '[अमान्य तारीख]', 'not-a-date'),
  entry('AAAAAAAAAA6', '[बाहरी लिंक]', '2026-11-05T10:00:00+00:00', 'https://evil.example/watch'),
)

describe('parseYouTubeFeed', () => {
  it('returns the newest 3 valid entries, newest first', () => {
    const posts = parseYouTubeFeed(FIXTURE, 3)
    expect(posts.map((p) => p.id)).toEqual(['AAAAAAAAAA2', 'AAAAAAAAAA1', 'AAAAAAAAAA3'])
  })

  it('normalises each post', () => {
    const [newest, second] = parseYouTubeFeed(FIXTURE, 3)
    expect(newest).toEqual({
      platform: 'youtube',
      id: 'AAAAAAAAAA2',
      title: '[सबसे नया वीडियो]',
      url: 'https://www.youtube.com/shorts/AAAAAAAAAA2',
      isShort: true,
      thumbnail: { url: 'https://i.ytimg.com/vi/AAAAAAAAAA2/hqdefault.jpg', width: 480, height: 360 },
      publishedAt: '2026-11-09T11:09:48+05:30',
    })
    expect(second.title).toBe('[पहला वीडियो] & धामी "संवाद"')
  })

  it('skips entries with an invalid id or date, and never links off YouTube', () => {
    const posts = parseYouTubeFeed(FIXTURE, 10)
    expect(posts.map((p) => p.id)).not.toContain('bad id')
    expect(posts.map((p) => p.id)).not.toContain('AAAAAAAAAA5')
    expect(posts.find((p) => p.id === 'AAAAAAAAAA6')?.url).toBe('https://www.youtube.com/watch?v=AAAAAAAAAA6')
  })

  it('handles empty or garbage input', () => {
    expect(parseYouTubeFeed('')).toEqual([])
    expect(parseYouTubeFeed('<html>error</html>')).toEqual([])
    expect(parseYouTubeFeed(feed())).toEqual([])
  })

  it('trims long titles to ~120 characters at a word boundary', () => {
    const long = Array.from({ length: 40 }, (_, i) => `शब्द${i}`).join(' ')
    const [post] = parseYouTubeFeed(feed(entry('AAAAAAAAAA7', long, '2026-11-09T00:00:00+00:00')))
    expect(post.title.length).toBeLessThanOrEqual(121)
    expect(post.title.endsWith('…')).toBe(true)
    expect(long.startsWith(post.title.slice(0, -1))).toBe(true)
  })
})

describe('Shorts detection', () => {
  it('detects /shorts/ links on youtube.com only', () => {
    expect(isShortsLink('https://www.youtube.com/shorts/AAAAAAAAAA2')).toBe(true)
    expect(isShortsLink('https://youtube.com/shorts/AAAAAAAAAA2?feature=share')).toBe(true)
    expect(isShortsLink('https://m.youtube.com/shorts/AAAAAAAAAA2')).toBe(true)
    expect(isShortsLink('https://www.youtube.com/watch?v=AAAAAAAAAA1')).toBe(false)
    expect(isShortsLink('https://evil.example/shorts/AAAAAAAAAA2')).toBe(false)
    expect(isShortsLink('https://notyoutube.com/shorts/AAAAAAAAAA2')).toBe(false)
    expect(isShortsLink(undefined)).toBe(false)
    expect(isShortsLink('not a url')).toBe(false)
  })

  it('marks Shorts and builds canonical links from the id', () => {
    const posts = parseYouTubeFeed(
      feed(
        entry('AAAAAAAAAB1', '[short]', '2026-11-09T02:00:00+00:00', 'https://youtube.com/shorts/AAAAAAAAAB1?si=x'),
        entry('AAAAAAAAAB2', '[video]', '2026-11-09T01:00:00+00:00'),
      ),
    )
    expect(posts.map((p) => [p.isShort, p.url])).toEqual([
      [true, 'https://www.youtube.com/shorts/AAAAAAAAAB1'],
      [false, 'https://www.youtube.com/watch?v=AAAAAAAAAB2'],
    ])
  })
})

describe('helpers', () => {
  it('decodes XML entities', () => {
    expect(decodeXmlEntities('a &amp; b &lt;c&gt; &#39;d&#x27; &apos;')).toBe("a & b <c> 'd' '")
    expect(decodeXmlEntities('&unknown;')).toBe('&unknown;')
  })

  it('converts dates to IST ISO strings', () => {
    expect(toISTString('2026-11-09T05:39:48+00:00')).toBe('2026-11-09T11:09:48+05:30')
    expect(toISTString('nope')).toBeNull()
  })

  it('keeps short text as is', () => {
    expect(trimText('  छोटा   शीर्षक ')).toBe('छोटा शीर्षक')
  })

  it('formats Hindi relative time', () => {
    const now = Date.parse('2026-11-09T12:00:00+05:30')
    expect(formatRelative('2026-11-09T09:00:00+05:30', now)).toBe('3 घंटे पहले')
    expect(formatRelative('2026-11-09T11:59:40+05:30', now)).toBe('अभी')
  })
})

describe('fetchYouTubeLatest', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('never throws: network error → error status, one [social] warning', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(fetchYouTubeLatest(3)).resolves.toEqual({ status: 'error', posts: [] })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/^\[social\]/)
    warn.mockRestore()
  })

  it('HTTP error → error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(fetchYouTubeLatest(3)).resolves.toEqual({ status: 'error', posts: [] })
    warn.mockRestore()
  })

  it('uses the cache settings and a timeout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(FIXTURE, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const feedResult = await fetchYouTubeLatest(2)
    expect(feedResult.status).toBe('ok')
    expect(feedResult.posts).toHaveLength(2)
    const init = fetchMock.mock.calls[0][1]
    expect(init.next).toEqual({ revalidate: 300, tags: ['social'] })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})
