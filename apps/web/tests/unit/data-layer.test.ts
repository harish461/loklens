import { describe, expect, it } from 'vitest'

import { BadRequestError } from '../../src/lib/data/errors'
import { decodeCursor, encodeCursor } from '../../src/lib/data/cursor'
import { escapeLike, isEPaperDate, isSlug, parsePage, parsePageSize, parseSearchQuery } from '../../src/lib/data/params'
import {
  BRAND_FALLBACK_IMAGE,
  ORG_BYLINE,
  bylineFor,
  isBreakingNow,
  toArticleCard,
  toEPaper,
  toImage,
  toRichText,
  type MapContext,
} from '../../src/lib/data/serialize'
import { toEpoch, toIST } from '../../src/lib/data/time'
import { absoluteUrl, withVersion } from '../../src/lib/data/urls'

const NOW = new Date('2026-11-09T10:00:00Z')
const ctx: MapContext = { defaultImage: { ...BRAND_FALLBACK_IMAGE, alt: 'डिफ़ॉल्ट' }, now: NOW }

const media = {
  id: 7,
  alt: 'परीक्षण तस्वीर',
  url: '/api/media/file/a.webp',
  width: 1200,
  height: 675,
  updatedAt: '2026-11-09T09:00:00.000Z',
  sizes: { card: { url: '/api/media/file/a-640x360.webp', width: 640, height: 360 } },
}

const category = { id: 1, name: 'प्रदेश', slug: 'pradesh', order: 1, showInNav: true, createdAt: '', updatedAt: '' }

function articleDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    title: 'परीक्षण खबर',
    slug: 'parikshan-khabar',
    summary: 'सारांश',
    featuredImage: media,
    category,
    publishedAt: '2026-11-09T09:30:00.000Z',
    createdAt: '2026-11-09T09:00:00.000Z',
    updatedAt: '2026-11-09T09:45:00.000Z',
    isBreaking: false,
    isTrending: true,
    isFeatured: false,
    ...overrides,
  } as never
}

describe('time and URLs', () => {
  it('serialises UTC instants with the IST offset and no milliseconds', () => {
    expect(toIST('2026-11-09T10:00:00.123Z')).toBe('2026-11-09T15:30:00+05:30')
    expect(toIST(new Date('2026-11-08T18:29:59Z'))).toBe('2026-11-08T23:59:59+05:30')
  })

  it('rejects invalid dates instead of emitting garbage', () => {
    expect(() => toIST('not a date')).toThrow(RangeError)
    expect(toEpoch('nope')).toBeNull()
    expect(toEpoch(null)).toBeNull()
  })

  it('makes media URLs absolute and versioned', () => {
    expect(absoluteUrl('/a.webp', 'https://loklensnews.com')).toBe('https://loklensnews.com/a.webp')
    expect(absoluteUrl('/a.webp', '')).toBe('/a.webp')
    expect(withVersion('/a.webp', '2026-11-09T09:00:00.000Z')).toMatch(/^\/a\.webp\?v=\d+$/)
    expect(withVersion('/a.webp?x=1', '2026-11-09T09:00:00.000Z')).toMatch(/\?x=1&v=\d+$/)
  })
})

describe('parameters', () => {
  it('bounds page and pageSize (contract §2)', () => {
    expect(parsePage(undefined)).toBe(1)
    expect(parsePageSize(undefined)).toBe(20)
    expect(parsePageSize('50')).toBe(50)
    expect(() => parsePageSize(0)).toThrow(BadRequestError)
    expect(() => parsePageSize(51)).toThrow(BadRequestError)
    expect(() => parsePage(1.5)).toThrow(BadRequestError)
    expect(() => parsePage('abc')).toThrow(BadRequestError)
  })

  it('normalises and length-checks search text', () => {
    expect(parseSearchQuery('  धामी ')).toBe('धामी')
    expect(() => parseSearchQuery('a')).toThrow(BadRequestError)
    expect(() => parseSearchQuery('a'.repeat(101))).toThrow(BadRequestError)
    expect(escapeLike('50%_off\\x')).toBe('50\\%\\_off\\\\x')
  })

  it('validates slugs and e-paper dates', () => {
    expect(isSlug('pradesh')).toBe(true)
    expect(isSlug('Bad Slug')).toBe(false)
    expect(isSlug('../etc')).toBe(false)
    expect(isEPaperDate('2026-11-09')).toBe(true)
    expect(isEPaperDate('2026-02-30')).toBe(false)
    expect(isEPaperDate('09-11-2026')).toBe(false)
  })
})

describe('cursor', () => {
  it('round-trips (publishedAt, id)', () => {
    const cursor = { publishedAt: '2026-11-09T09:30:00.000Z', id: 42 }
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
  })

  it('rejects tampered or foreign cursors with BadRequest', () => {
    expect(() => decodeCursor('not-base64-json')).toThrow(BadRequestError)
    expect(() => decodeCursor(Buffer.from('{"t":"x","i":1}').toString('base64url'))).toThrow(BadRequestError)
    expect(() => decodeCursor(Buffer.from('{"t":"2026-11-09T00:00:00Z","i":-1}').toString('base64url'))).toThrow(BadRequestError)
  })
})

describe('serializer', () => {
  it('uses the site default image when the media is missing (isFallback true)', () => {
    const img = toImage(null, ctx.defaultImage)
    expect(img.isFallback).toBe(true)
    expect(img.alt).toBe('डिफ़ॉल्ट')
  })

  it('maps an uploaded image with its sizes and never leaves alt empty', () => {
    const img = toImage(media, ctx.defaultImage)
    expect(img.isFallback).toBe(false)
    expect(img.url).toMatch(/^\/api\/media\/file\/a\.webp\?v=\d+$/)
    expect(img.alt).toBe('परीक्षण तस्वीर')
    expect(Object.keys(img.sizes)).toEqual(['card'])
  })

  it('byline is the organisation when no authors are set', () => {
    expect(bylineFor([])).toEqual([ORG_BYLINE])
    expect(bylineFor(null)).toEqual([ORG_BYLINE])
  })

  it('byline uses the Hindi display name and drops email and role', () => {
    const [author] = bylineFor([{ id: 3, name: 'Rahul', displayName: 'राहुल नेगी', slug: 'rahul', email: 'x@y.z', role: 'admin' }])
    expect(author).toEqual({ kind: 'person', name: 'राहुल नेगी', slug: 'rahul' })
  })

  it('breaking label is off once breakingUntil has passed', () => {
    expect(isBreakingNow({ isBreaking: true, breakingUntil: '2026-11-09T09:00:00Z' }, NOW)).toBe(false)
    expect(isBreakingNow({ isBreaking: true, breakingUntil: '2026-11-09T11:00:00Z' }, NOW)).toBe(true)
    expect(isBreakingNow({ isBreaking: true, breakingUntil: null }, NOW)).toBe(true)
    expect(isBreakingNow({ isBreaking: false, breakingUntil: '2026-11-09T11:00:00Z' }, NOW)).toBe(false)
  })

  it('article card carries the canonical URL, IST dates and no internal fields', () => {
    const card = toArticleCard(articleDoc(), ctx)
    expect(card).not.toBeNull()
    expect(card).toMatchObject({
      id: 42,
      url: '/pradesh/parikshan-khabar-42',
      publishedAt: '2026-11-09T15:00:00+05:30',
      updatedAt: '2026-11-09T15:15:00+05:30',
      isBreaking: false,
      isTrending: true,
    })
    expect(card && 'createdBy' in card).toBe(false)
    expect(card && '_status' in card).toBe(false)
  })

  it('drops an article whose category is not populated', () => {
    expect(toArticleCard(articleDoc({ category: 1 }), ctx)).toBeNull()
  })

  it('rich text keeps paragraphs, drops unresolved uploads and unsafe links', () => {
    const body = {
      root: {
        children: [
          { type: 'upload', value: 99 },
          {
            type: 'paragraph',
            children: [
              { type: 'link', fields: { url: 'javascript:alert(1)', linkType: 'custom' }, children: [{ type: 'text', text: 'x' }] },
              { type: 'link', fields: { url: 'https://uk.gov.in', linkType: 'custom' }, children: [{ type: 'text', text: 'y' }] },
            ],
          },
        ],
      },
    }
    const nodes = toRichText(body, ctx)
    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0] as unknown as { children: { type: string; text?: string; fields?: { url: string } }[] }
    expect(paragraph.children.some((c) => c.fields?.url?.startsWith('javascript:'))).toBe(false)
    expect(paragraph.children.some((c) => c.type === 'text' && c.text === 'x')).toBe(true)
  })

  it('e-paper PDF URLs are absolute when the site URL is configured', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = 'https://loklensnews.com/'
    try {
      expect(toEPaper({ id: 1, date: '2026-11-09', edition: 'उत्तराखंड', url: '/api/epapers/file/a.pdf' } as never).pdfUrl).toBe(
        'https://loklensnews.com/api/epapers/file/a.pdf',
      )
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
      else process.env.NEXT_PUBLIC_SITE_URL = prev
    }
  })
})
