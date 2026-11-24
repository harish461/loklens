/**
 * Public mobile API v1 (docs/api-contract.md §2–§3): status codes, ApiError bodies, Cache-Control, CORS
 * and parameter pass-through. The data helpers are mocked; their own rules are covered in data-layer.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const data = vi.hoisted(() => ({
  getHome: vi.fn(),
  listArticles: vi.fn(),
  getArticle: vi.fn(),
  listCategories: vi.fn(),
  getCategory: vi.fn(),
  getTag: vi.fn(),
  getAuthor: vi.fn(),
  listVideos: vi.fn(),
  getVideo: vi.fn(),
  listEPapers: vi.fn(),
  getEPaper: vi.fn(),
  getPage: vi.fn(),
  search: vi.fn(),
  getSiteSettings: vi.fn(),
}))

const social = vi.hoisted(() => ({ getYouTubeShorts: vi.fn() }))
vi.mock('@/lib/social', () => social)

// The real helpers need the Payload config; only the error helpers are real here.
vi.mock('@/lib/data', async () => ({ ...(await import('../../src/lib/data/errors')), ...data }))

import { BadRequestError } from '../../src/lib/data/errors'
import { idParam, numberParam } from '../../src/app/api/v1/_lib/http'
import * as home from '../../src/app/api/v1/home/route'
import * as articles from '../../src/app/api/v1/articles/route'
import * as article from '../../src/app/api/v1/articles/[id]/route'
import * as categories from '../../src/app/api/v1/categories/route'
import * as category from '../../src/app/api/v1/categories/[slug]/route'
import * as tag from '../../src/app/api/v1/tags/[slug]/route'
import * as author from '../../src/app/api/v1/authors/[slug]/route'
import * as videos from '../../src/app/api/v1/videos/route'
import * as video from '../../src/app/api/v1/videos/[slug]/route'
import * as epapers from '../../src/app/api/v1/epapers/route'
import * as epaper from '../../src/app/api/v1/epapers/[date]/route'
import * as page from '../../src/app/api/v1/pages/[slug]/route'
import * as searchRoute from '../../src/app/api/v1/search/route'
import * as settings from '../../src/app/api/v1/settings/route'
import * as rest from '../../src/app/api/v1/[...rest]/route'
import * as shorts from '../../src/app/api/v1/shorts/route'

const BASE = 'https://loklensnews.com/api/v1'
const DEFAULT_CACHE = 'public, s-maxage=60, stale-while-revalidate=300'

type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response> | Response

function call(handler: Handler, path: string, params: Record<string, unknown> = {}) {
  return handler(new Request(`${BASE}${path}`), { params: Promise.resolve(params as never) })
}

async function expectJson(res: Response, status: number, cache: string) {
  expect(res.status).toBe(status)
  expect(res.headers.get('cache-control')).toBe(cache)
  expect(res.headers.get('access-control-allow-origin')).toBe('*')
  expect(res.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
  return res.json()
}

beforeEach(() => {
  for (const fn of Object.values(data)) fn.mockReset()
  social.getYouTubeShorts.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('query helpers', () => {
  it('numberParam: absent → undefined, everything else → Number (helpers validate)', () => {
    const q = new URLSearchParams('page=2&pageSize=&bad=abc&frac=1.5')
    expect(numberParam(q, 'missing')).toBeUndefined()
    expect(numberParam(q, 'page')).toBe(2)
    expect(numberParam(q, 'pageSize')).toBeNaN()
    expect(numberParam(q, 'bad')).toBeNaN()
    expect(numberParam(q, 'frac')).toBe(1.5)
  })

  it('idParam: positive integers only', () => {
    expect(idParam('56')).toBe(56)
    for (const bad of ['0', '-1', '01', '1.5', 'abc', '56abc', '', '99999999999999999']) expect(idParam(bad)).toBeNull()
  })
})

describe('success responses', () => {
  const cases: [string, Handler, keyof typeof data, string, Record<string, string>?][] = [
    ['home', home.GET as Handler, 'getHome', '/home'],
    ['categories', categories.GET as Handler, 'listCategories', '/categories'],
    ['category', category.GET as Handler, 'getCategory', '/categories/desh', { slug: 'desh' }],
    ['tag', tag.GET as Handler, 'getTag', '/tags/rojgar', { slug: 'rojgar' }],
    ['author', author.GET as Handler, 'getAuthor', '/authors/rahul', { slug: 'rahul' }],
    ['video', video.GET as Handler, 'getVideo', '/videos/v1', { slug: 'v1' }],
    ['epaper', epaper.GET as Handler, 'getEPaper', '/epapers/2026-11-09', { date: '2026-11-09' }],
    ['page', page.GET as Handler, 'getPage', '/pages/about', { slug: 'about' }],
    ['settings', settings.GET as Handler, 'getSiteSettings', '/settings'],
  ]

  it.each(cases)('%s → 200 with the helper result and public cache headers', async (_n, handler, fn, path, params) => {
    const shape = { marker: fn }
    data[fn].mockResolvedValue(shape)
    const body = await expectJson(await call(handler, path, params), 200, DEFAULT_CACHE)
    expect(body).toEqual(shape)
    if (params) expect(data[fn]).toHaveBeenCalledWith(Object.values(params)[0])
  })

  it.each(cases.filter((c) => c[4]))('%s → 404 ApiError when the helper returns null', async (_n, handler, fn, path, params) => {
    data[fn].mockResolvedValue(null)
    const body = await expectJson(await call(handler, path, params), 404, 'no-store')
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

describe('GET /api/v1/articles', () => {
  it('page mode passes every filter through', async () => {
    data.listArticles.mockResolvedValue({ items: [], page: 2 })
    await expectJson(
      await call(articles.GET as Handler, '/articles?page=2&pageSize=10&category=desh&tag=rojgar&author=rahul&flag=featured'),
      200,
      DEFAULT_CACHE,
    )
    expect(data.listArticles).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      category: 'desh',
      tag: 'rojgar',
      author: 'rahul',
      flag: 'featured',
    })
  })

  it('an empty cursor switches to cursor mode', async () => {
    data.listArticles.mockResolvedValue({ items: [], nextCursor: null })
    await call(articles.GET as Handler, '/articles?cursor=')
    expect(data.listArticles).toHaveBeenCalledWith(expect.objectContaining({ cursor: '', page: undefined }))
  })

  it('no cursor → no cursor key (page mode)', async () => {
    data.listArticles.mockResolvedValue({ items: [] })
    await call(articles.GET as Handler, '/articles')
    expect(data.listArticles.mock.calls[0][0]).not.toHaveProperty('cursor')
  })

  it('helper BadRequestError → 400 ApiError, not cached', async () => {
    data.listArticles.mockRejectedValue(new BadRequestError('page and cursor cannot be used together.'))
    const body = await expectJson(await call(articles.GET as Handler, '/articles?page=1&cursor='), 400, 'no-store')
    expect(body).toEqual({ error: { code: 'BAD_REQUEST', message: 'page and cursor cannot be used together.' } })
  })

  it('unexpected error → generic 500 without internal details', async () => {
    data.listArticles.mockRejectedValue(new Error('connection to db.internal:5432 refused'))
    const body = await expectJson(await call(articles.GET as Handler, '/articles'), 500, 'no-store')
    expect(body).toEqual({ error: { code: 'SERVER_ERROR', message: 'Internal error' } })
    expect(JSON.stringify(body)).not.toContain('5432')
  })
})

describe('GET /api/v1/articles/{id}', () => {
  it('numeric id → getArticle(number)', async () => {
    data.getArticle.mockResolvedValue({ id: 56 })
    await expectJson(await call(article.GET as Handler, '/articles/56', { id: '56' }), 200, DEFAULT_CACHE)
    expect(data.getArticle).toHaveBeenCalledWith(56)
  })

  it.each(['abc', '0', '-3', '56-slug'])('non-numeric id %s → 404 without a lookup', async (id) => {
    const body = await expectJson(await call(article.GET as Handler, `/articles/${id}`, { id }), 404, 'no-store')
    expect(body.error.code).toBe('NOT_FOUND')
    expect(data.getArticle).not.toHaveBeenCalled()
  })

  it('unpublished / unknown → 404', async () => {
    data.getArticle.mockResolvedValue(null)
    expect((await call(article.GET as Handler, '/articles/9', { id: '9' })).status).toBe(404)
  })
})

describe('lists and search', () => {
  it.each([
    ['videos', videos.GET as Handler, 'listVideos' as const],
    ['epapers', epapers.GET as Handler, 'listEPapers' as const],
  ])('%s passes page and pageSize', async (name, handler, fn) => {
    data[fn].mockResolvedValue({ items: [] })
    await call(handler, `/${name}?page=3&pageSize=5`)
    expect(data[fn]).toHaveBeenCalledWith({ page: 3, pageSize: 5 })
  })

  it('search uses the shorter search cache and passes q', async () => {
    data.search.mockResolvedValue({ items: [] })
    await expectJson(
      await call(searchRoute.GET as Handler, '/search?q=%E0%A4%A6%E0%A4%BF%E0%A4%B2%E0%A5%8D%E0%A4%B2%E0%A5%80&page=1'),
      200,
      'public, s-maxage=30, stale-while-revalidate=60',
    )
    expect(data.search).toHaveBeenCalledWith({ q: 'दिल्ली', page: 1, pageSize: undefined })
  })

  it('search without q → 400 from the helper', async () => {
    data.search.mockRejectedValue(new BadRequestError('q is required.'))
    expect((await call(searchRoute.GET as Handler, '/search')).status).toBe(400)
    expect(data.search).toHaveBeenCalledWith(expect.objectContaining({ q: null }))
  })
})

describe('protocol rules', () => {
  it('unknown /api/v1 path → 404 ApiError', async () => {
    const body = await expectJson(await call(rest.GET as Handler, '/nope', { rest: ['nope'] }), 404, 'no-store')
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('OPTIONS preflight → 204 with CORS headers', () => {
    const res = (home.OPTIONS as () => Response)()
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
  })

  it('routes export only GET and OPTIONS (other methods → 405 from Next.js)', () => {
    for (const mod of [home, articles, article, categories, category, tag, author, videos, video, epapers, epaper, page, searchRoute, settings, rest, shorts]) {
      expect(Object.keys(mod).filter((k) => /^[A-Z]+$/.test(k)).sort()).toEqual(['GET', 'OPTIONS'])
    }
  })
})

describe('GET /api/v1/shorts', () => {
  const post = {
    platform: 'youtube',
    id: 'abcdefghijk',
    title: 'शॉर्ट',
    url: 'https://www.youtube.com/shorts/abcdefghijk',
    isShort: true,
    thumbnail: { url: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg', width: 480, height: 360 },
    publishedAt: '2026-11-24T10:00:00+05:30',
  }

  it('returns { items } without internal fields, with the shorts cache profile', async () => {
    social.getYouTubeShorts.mockResolvedValue({ status: 'ok', posts: [post] })
    const body = await expectJson(await call(shorts.GET as Handler, '/shorts'), 200, 'public, s-maxage=300, stale-while-revalidate=600')
    expect(body).toEqual({ items: [{ id: post.id, title: post.title, url: post.url, thumbnail: post.thumbnail, publishedAt: post.publishedAt }] })
    expect(social.getYouTubeShorts).toHaveBeenCalledWith(20)
  })

  it('passes limit and rejects out-of-range limits with 400', async () => {
    social.getYouTubeShorts.mockResolvedValue({ status: 'ok', posts: [] })
    await call(shorts.GET as Handler, '/shorts?limit=5')
    expect(social.getYouTubeShorts).toHaveBeenCalledWith(5)
    for (const bad of ['0', '51', 'abc', '']) {
      expect((await call(shorts.GET as Handler, `/shorts?limit=${bad}`)).status).toBe(400)
    }
  })

  it('feed unavailable → 503 SERVER_ERROR, not cached', async () => {
    social.getYouTubeShorts.mockResolvedValue({ status: 'error', posts: [] })
    const body = await expectJson(await call(shorts.GET as Handler, '/shorts'), 503, 'no-store')
    expect(body.error.code).toBe('SERVER_ERROR')
  })
})
