/**
 * Typed, cached read helpers: the implementation of docs/api-contract.md §2 for the web.
 *
 * Every query uses the Payload local API with `overrideAccess: false` and `draft: false`, so the
 * collection read rules (published only for anonymous users) and an explicit `_status = published`
 * filter both apply. Nothing here returns Payload documents directly; ./serialize.ts maps them.
 */
import type { Payload, Where } from 'payload'
import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@payload-config'

import { articlePath, cacheTags } from '../revalidate/tags'
import { cachedRead } from './cache'
import { BadRequestError } from './errors'
import { decodeCursor, encodeCursor, type ArticleCursor } from './cursor'
import { escapeLike, isEPaperDate, isSlug, parsePage, parsePageSize, parseSearchQuery } from './params'
import {
  BRAND_FALLBACK_IMAGE,
  asFallback,
  nonNull,
  toArticle,
  toArticleCard,
  toAuthor,
  toCategory,
  toCategoryRef,
  toEPaper,
  toImage,
  toNavItem,
  toPage,
  toSiteSettings,
  toTagRef,
  toVideo,
  type MapContext,
} from './serialize'
import { toIST } from './time'
import { absoluteUrl } from './urls'
import type {
  Article,
  ArticleCard,
  Author,
  Category,
  CursorPage,
  EPaper,
  Home,
  ListArticlesParams,
  NavItem,
  Page,
  Paginated,
  SearchParams,
  SiteSettings,
  TagRef,
  Video,
} from './types'

// ---- shared query pieces --------------------------------------------------------------------------

type Db = Payload

/** Public read: anonymous access rules, draft versions excluded. */
const PUBLIC = { overrideAccess: false, draft: false } as const
const PUBLISHED: Where = { _status: { equals: 'published' } }
const NEWEST_FIRST = ['-publishedAt', '-id']
const FLAGS = ['breaking', 'trending', 'featured'] as const
type Flag = (typeof FLAGS)[number]

const getDb = (): Promise<Db> => getPayload({ config })

/** Mapping context: the site default image and the request time (for breaking labels). */
async function mapContext(db: Db): Promise<MapContext> {
  const settings = await db.findGlobal({ slug: 'site-settings', depth: 1, ...PUBLIC })
  return {
    defaultImage: asFallback(toImage(settings.defaultImage, BRAND_FALLBACK_IMAGE)),
    now: new Date(),
  }
}

/** Breaking label still active (breakingUntil unset or in the future). Mirrors isBreakingNow(). */
function activeBreaking(now: Date): Where {
  return {
    and: [
      { isBreaking: { equals: true } },
      { or: [{ breakingUntil: { exists: false } }, { breakingUntil: { greater_than: now.toISOString() } }] },
    ],
  }
}

/** Id of a published-or-public taxonomy/person document by slug, or null when it does not exist. */
async function idBySlug(db: Db, collection: 'categories' | 'tags' | 'users', slug: string): Promise<number | null> {
  const res = await db.find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    pagination: false,
    ...PUBLIC,
  })
  return res.docs[0]?.id ?? null
}

function idOf(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) return Number((value as { id: unknown }).id)
  return null
}

function paginated<T, R>(
  res: { docs: T[]; totalDocs: number; totalPages: number; hasNextPage: boolean },
  page: number,
  pageSize: number,
  map: (doc: T) => R | null,
): Paginated<R> {
  return {
    items: res.docs.map(map).filter(nonNull),
    page,
    pageSize,
    totalItems: res.totalDocs,
    totalPages: Math.max(1, res.totalPages),
    hasNextPage: res.hasNextPage,
  }
}

// ---- articles -------------------------------------------------------------------------------------

interface NormalizedList {
  mode: 'page' | 'cursor'
  page: number
  pageSize: number
  category?: string
  tag?: string
  author?: string
  flag?: Flag
  /** Cursor mode: null = first page. */
  cursor?: ArticleCursor | null
}

function optionalSlug(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (!isSlug(value)) throw new BadRequestError(`${name} must be a lowercase slug.`)
  return value
}

/** Validates the contract query parameters (§2 "listArticles query parameters"). Throws BadRequest. */
function normalizeListParams(params: ListArticlesParams): NormalizedList {
  const isCursor = params.cursor !== undefined
  if (isCursor && params.page !== undefined) {
    throw new BadRequestError('page and cursor cannot be used together.')
  }
  if (params.flag !== undefined && !(FLAGS as readonly string[]).includes(params.flag)) {
    throw new BadRequestError('flag must be breaking, trending or featured.')
  }
  return {
    mode: isCursor ? 'cursor' : 'page',
    page: parsePage(params.page),
    pageSize: parsePageSize(params.pageSize),
    category: optionalSlug(params.category, 'category'),
    tag: optionalSlug(params.tag, 'tag'),
    author: optionalSlug(params.author, 'author'),
    flag: params.flag,
    cursor: isCursor ? (params.cursor === '' ? null : decodeCursor(params.cursor as string)) : undefined,
  }
}

/** Builds the where clause. Returns null when a filter names an unknown slug (no matches). */
async function articleWhere(db: Db, q: NormalizedList, now: Date): Promise<Where | null> {
  const and: Where[] = [PUBLISHED]
  if (q.category) {
    const id = await idBySlug(db, 'categories', q.category)
    if (id === null) return null
    and.push({ category: { equals: id } })
  }
  if (q.tag) {
    const id = await idBySlug(db, 'tags', q.tag)
    if (id === null) return null
    and.push({ tags: { equals: id } })
  }
  if (q.author) {
    const id = await idBySlug(db, 'users', q.author)
    if (id === null) return null
    and.push({ authors: { equals: id } })
  }
  if (q.flag === 'breaking') and.push(activeBreaking(now))
  if (q.flag === 'trending') and.push({ isTrending: { equals: true } })
  if (q.flag === 'featured') and.push({ isFeatured: { equals: true } })
  if (q.cursor) {
    const { publishedAt, id } = q.cursor
    and.push({
      or: [
        { publishedAt: { less_than: publishedAt } },
        { and: [{ publishedAt: { equals: publishedAt } }, { id: { less_than: id } }] },
      ],
    })
  }
  return { and }
}

function listTags(q: NormalizedList): string[] {
  const tags: string[] = []
  if (q.category) tags.push(cacheTags.category(q.category))
  if (q.tag) tags.push(cacheTags.tag(q.tag))
  if (q.author) tags.push(cacheTags.author(q.author))
  // Unfiltered and flag lists change whenever any article changes; every article save expires `home`.
  if (!q.category && !q.tag && !q.author) tags.push(cacheTags.home)
  tags.push(cacheTags.settings)
  return tags
}

async function listArticlesUncached(q: NormalizedList): Promise<Paginated<ArticleCard> | CursorPage<ArticleCard>> {
  const db = await getDb()
  const ctx = await mapContext(db)
  const where = await articleWhere(db, q, ctx.now)

  if (q.mode === 'cursor') {
    if (!where) return { items: [], nextCursor: null }
    // Fetch one extra row to know whether another page exists.
    const res = await db.find({
      collection: 'articles',
      where,
      sort: NEWEST_FIRST,
      limit: q.pageSize + 1,
      pagination: false,
      depth: 1,
      ...PUBLIC,
    })
    const pageDocs = res.docs.slice(0, q.pageSize)
    const items = pageDocs.map((d) => toArticleCard(d, ctx)).filter(nonNull)
    const last = pageDocs[pageDocs.length - 1]
    const nextCursor =
      res.docs.length > q.pageSize && last
        ? encodeCursor({ publishedAt: new Date(last.publishedAt ?? last.createdAt).toISOString(), id: last.id })
        : null
    return { items, nextCursor }
  }

  if (!where) {
    return { items: [], page: q.page, pageSize: q.pageSize, totalItems: 0, totalPages: 1, hasNextPage: false }
  }
  const res = await db.find({
    collection: 'articles',
    where,
    sort: NEWEST_FIRST,
    page: q.page,
    limit: q.pageSize,
    depth: 1,
    ...PUBLIC,
  })
  return paginated(res, q.page, q.pageSize, (d) => toArticleCard(d, ctx))
}

export async function listArticles(params: ListArticlesParams & { cursor: string }): Promise<CursorPage<ArticleCard>>
export async function listArticles(params?: ListArticlesParams): Promise<Paginated<ArticleCard>>
export async function listArticles(
  params: ListArticlesParams = {},
): Promise<Paginated<ArticleCard> | CursorPage<ArticleCard>> {
  const q = normalizeListParams(params)
  return cachedRead(['articles', JSON.stringify(q)], listTags(q), () => listArticlesUncached(q))
}

/** Latest published articles of an optional category (RSS: latest 50). */
export const listForFeed = cache(async (category?: string): Promise<ArticleCard[]> => {
  const slug = optionalSlug(category, 'category')
  return cachedRead(
    ['feed', slug ?? 'all'],
    [cacheTags.feeds, ...(slug ? [cacheTags.category(slug)] : [])],
    async () => {
      const db = await getDb()
      const ctx = await mapContext(db)
      const and: Where[] = [PUBLISHED]
      if (slug) {
        const id = await idBySlug(db, 'categories', slug)
        if (id === null) return []
        and.push({ category: { equals: id } })
      }
      const res = await db.find({
        collection: 'articles',
        where: { and },
        sort: NEWEST_FIRST,
        limit: 50,
        depth: 1,
        ...PUBLIC,
      })
      return res.docs.map((d) => toArticleCard(d, ctx)).filter(nonNull)
    },
  )
})

/** Up to 6 published articles sharing a tag or the category (contract §1 `related`). */
async function relatedArticles(db: Db, doc: Record<string, unknown>, ctx: MapContext): Promise<ArticleCard[]> {
  const categoryId = idOf(doc.category)
  const tagIds = (Array.isArray(doc.tags) ? doc.tags : []).map(idOf).filter(nonNull)
  const or: Where[] = []
  if (categoryId !== null) or.push({ category: { equals: categoryId } })
  if (tagIds.length > 0) or.push({ tags: { in: tagIds } })
  if (or.length === 0) return []
  const res = await db.find({
    collection: 'articles',
    where: { and: [PUBLISHED, { id: { not_equals: doc.id as number } }, { or }] },
    sort: NEWEST_FIRST,
    limit: 6,
    depth: 1,
    ...PUBLIC,
  })
  return res.docs.map((d) => toArticleCard(d, ctx)).filter(nonNull)
}

/** Single article by id. Returns null for unknown or unpublished ids (contract §3, 404). */
export const getArticle = cache(async (id: number): Promise<Article | null> => {
  if (!Number.isSafeInteger(id) || id < 1) return null
  return cachedRead(['article', String(id)], [cacheTags.article(id), cacheTags.settings], async () => {
    const db = await getDb()
    const doc = await db.findByID({ collection: 'articles', id, depth: 2, disableErrors: true, ...PUBLIC })
    if (!doc || doc._status !== 'published') return null
    const ctx = await mapContext(db)
    const related = await relatedArticles(db, doc as unknown as Record<string, unknown>, ctx)
    return toArticle(doc, ctx, related)
  })
})

// ---- home -----------------------------------------------------------------------------------------

export const getHome = cache(async (): Promise<Home> =>
  cachedRead(['home'], [cacheTags.home, cacheTags.settings, cacheTags.videos], async () => {
    const db = await getDb()
    const ctx = await mapContext(db)
    const cards = async (where: Where, limit: number) => {
      const res = await db.find({ collection: 'articles', where, sort: NEWEST_FIRST, limit, depth: 1, ...PUBLIC })
      return res.docs.map((d) => toArticleCard(d, ctx)).filter(nonNull)
    }

    const ticker = await db.findGlobal({ slug: 'ticker', depth: 0, ...PUBLIC })
    const manual = (ticker.items ?? []).map((i) => ({ title: i.title, url: i.url })).slice(0, 10)
    const trending = manual.length > 0 ? manual : await trendingTicker(db, ctx)

    const breaking = await cards({ and: [PUBLISHED, activeBreaking(ctx.now)] }, 5)
    const featured = await cards({ and: [PUBLISHED, { isFeatured: { equals: true } }] }, 6)
    const latest = await cards(PUBLISHED, 12)

    const navCategories = await db.find({
      collection: 'categories',
      where: { showInNav: { equals: true } },
      sort: 'order',
      pagination: false,
      depth: 0,
      ...PUBLIC,
    })
    const sections: Home['sections'] = []
    for (const category of navCategories.docs) {
      const ref = toCategoryRef(category)
      if (!ref) continue
      sections.push({ category: ref, articles: await cards({ and: [PUBLISHED, { category: { equals: ref.id } }] }, 5) })
    }

    const videos = await videoCards(db, ctx, 4)
    return { ticker: trending, breaking, featured, latest, sections, videos }
  }),
)

async function trendingTicker(db: Db, ctx: MapContext): Promise<{ title: string; url: string }[]> {
  const res = await db.find({
    collection: 'articles',
    where: { and: [PUBLISHED, { isTrending: { equals: true } }] },
    sort: NEWEST_FIRST,
    limit: 10,
    depth: 1,
    ...PUBLIC,
  })
  return res.docs
    .map((d) => toArticleCard(d, ctx))
    .filter(nonNull)
    .map((a) => ({ title: a.title, url: a.url }))
}

// ---- categories, tags, authors --------------------------------------------------------------------

export const listCategories = cache(async (): Promise<Category[]> =>
  cachedRead(['categories'], [cacheTags.settings, cacheTags.home], async () => {
    const db = await getDb()
    const res = await db.find({
      collection: 'categories',
      sort: ['order', 'name'],
      pagination: false,
      depth: 0,
      ...PUBLIC,
    })
    return res.docs.map(toCategory)
  }),
)

export const getCategory = cache(async (slug: string): Promise<Category | null> => {
  if (!isSlug(slug)) return null
  return cachedRead(['category', slug], [cacheTags.category(slug), cacheTags.settings], async () => {
    const db = await getDb()
    const res = await db.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      pagination: false,
      ...PUBLIC,
    })
    const doc = res.docs[0]
    return doc ? toCategory(doc) : null
  })
})

export const getTag = cache(async (slug: string): Promise<TagRef | null> => {
  if (!isSlug(slug)) return null
  return cachedRead(['tag', slug], [cacheTags.tag(slug)], async () => {
    const db = await getDb()
    const res = await db.find({
      collection: 'tags',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      pagination: false,
      ...PUBLIC,
    })
    return toTagRef(res.docs[0])
  })
})

export const getAuthor = cache(async (slug: string): Promise<Author | null> => {
  if (!isSlug(slug)) return null
  return cachedRead(['author', slug], [cacheTags.author(slug)], async () => {
    const db = await getDb()
    const res = await db.find({
      collection: 'users',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
      pagination: false,
      ...PUBLIC,
    })
    const user = res.docs[0]
    return user ? toAuthor(user, BRAND_FALLBACK_IMAGE) : null
  })
})

// ---- videos ---------------------------------------------------------------------------------------

async function videoCards(db: Db, ctx: MapContext, limit: number): Promise<Video[]> {
  const res = await db.find({
    collection: 'videos',
    where: PUBLISHED,
    sort: '-publishedAt',
    limit,
    depth: 1,
    ...PUBLIC,
  })
  return res.docs.map((d) => toVideo(d, ctx))
}

export const listVideos = async (params: { page?: number; pageSize?: number } = {}): Promise<Paginated<Video>> => {
  const page = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  return cachedRead(['videos', String(page), String(pageSize)], [cacheTags.videos], async () => {
    const db = await getDb()
    const ctx = await mapContext(db)
    const res = await db.find({
      collection: 'videos',
      where: PUBLISHED,
      sort: '-publishedAt',
      page,
      limit: pageSize,
      depth: 1,
      ...PUBLIC,
    })
    return paginated(res, page, pageSize, (d) => toVideo(d, ctx))
  })
}

export const getVideo = cache(async (slug: string): Promise<Video | null> => {
  if (!isSlug(slug)) return null
  return cachedRead(['video', slug], [cacheTags.video(slug), cacheTags.videos], async () => {
    const db = await getDb()
    const ctx = await mapContext(db)
    const res = await db.find({
      collection: 'videos',
      where: { and: [PUBLISHED, { slug: { equals: slug } }] },
      limit: 1,
      depth: 1,
      ...PUBLIC,
    })
    const doc = res.docs[0]
    return doc ? toVideo(doc, ctx) : null
  })
})

// ---- e-paper --------------------------------------------------------------------------------------

export const listEPapers = async (params: { page?: number; pageSize?: number } = {}): Promise<Paginated<EPaper>> => {
  const page = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  return cachedRead(['epapers', String(page), String(pageSize)], [cacheTags.epapers], async () => {
    const db = await getDb()
    const res = await db.find({
      collection: 'epapers',
      sort: '-date',
      page,
      limit: pageSize,
      depth: 0,
      ...PUBLIC,
    })
    return paginated(res, page, pageSize, toEPaper)
  })
}

export const getEPaper = cache(async (date: string): Promise<EPaper | null> => {
  if (!isEPaperDate(date)) return null
  return cachedRead(['epaper', date], [cacheTags.epaper(date)], async () => {
    const db = await getDb()
    const res = await db.find({
      collection: 'epapers',
      where: { date: { equals: date } },
      limit: 1,
      depth: 0,
      pagination: false,
      ...PUBLIC,
    })
    const doc = res.docs[0]
    return doc ? toEPaper(doc) : null
  })
})

// ---- pages, search, settings ----------------------------------------------------------------------

export const getPage = cache(async (slug: string): Promise<Page | null> => {
  if (!isSlug(slug)) return null
  return cachedRead(['page', slug], [cacheTags.page(slug)], async () => {
    const db = await getDb()
    const ctx = await mapContext(db)
    const res = await db.find({
      collection: 'pages',
      where: { and: [PUBLISHED, { slug: { equals: slug } }] },
      limit: 1,
      depth: 1,
      ...PUBLIC,
    })
    const doc = res.docs[0]
    return doc ? toPage(doc, ctx) : null
  })
})

/**
 * Search is deliberately not cached (architecture §4: "Search: dynamic, never cached").
 * Title and summary, case-insensitive, published only.
 */
export async function search(params: SearchParams): Promise<Paginated<ArticleCard>> {
  const q = parseSearchQuery(params.q)
  const page = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const term = escapeLike(q)
  const db = await getDb()
  const ctx = await mapContext(db)
  const res = await db.find({
    collection: 'articles',
    where: {
      and: [PUBLISHED, { or: [{ title: { contains: term } }, { summary: { contains: term } }] }],
    },
    sort: NEWEST_FIRST,
    page,
    limit: pageSize,
    depth: 1,
    ...PUBLIC,
  })
  return paginated(res, page, pageSize, (d) => toArticleCard(d, ctx))
}

export const getSiteSettings = cache(async (): Promise<SiteSettings> =>
  cachedRead(['settings'], [cacheTags.settings], async () => {
    const db = await getDb()
    const settings = await db.findGlobal({ slug: 'site-settings', depth: 1, ...PUBLIC })
    const navigation = await db.findGlobal({ slug: 'navigation', depth: 0, ...PUBLIC })
    // Header falls back to the categories flagged "show in nav" (Navigation global is empty by default).
    const navCategories = await db.find({
      collection: 'categories',
      where: { showInNav: { equals: true } },
      sort: 'order',
      pagination: false,
      depth: 0,
      ...PUBLIC,
    })
    const categoryNav = navCategories.docs
      .map((c) => toNavItem({ label: c.name, url: `/${c.slug}` }))
      .filter(nonNull) as NavItem[]
    return toSiteSettings(settings, navigation, categoryNav)
  }),
)

// ---- sitemaps and feeds ---------------------------------------------------------------------------

export type SitemapEntry = {
  url: string
  updatedAt: string
  type: 'article' | 'category' | 'tag' | 'author' | 'page' | 'video' | 'epaper'
}

export const listSitemapEntries = cache(async (): Promise<SitemapEntry[]> =>
  cachedRead(['sitemap'], [cacheTags.feeds], async () => {
    const db = await getDb()
    const categories = await db.find({ collection: 'categories', pagination: false, depth: 0, ...PUBLIC })
    const categorySlug = new Map(categories.docs.map((c) => [c.id, c.slug]))

    const articles = await db.find({ collection: 'articles', where: PUBLISHED, pagination: false, depth: 0, ...PUBLIC })
    const tagIds = new Set<number>()
    const authorIds = new Set<number>()
    const entries: SitemapEntry[] = []

    for (const a of articles.docs) {
      const cat = categorySlug.get(idOf(a.category) ?? -1)
      if (!cat) continue
      for (const t of a.tags ?? []) tagIds.add(idOf(t) ?? -1)
      for (const u of a.authors ?? []) authorIds.add(idOf(u) ?? -1)
      entries.push({
        url: absoluteUrl(articlePath(cat, a.slug, a.id)),
        updatedAt: toIST(a.updatedAt),
        type: 'article',
      })
    }

    for (const c of categories.docs) {
      entries.push({ url: absoluteUrl(`/${c.slug}`), updatedAt: toIST(c.updatedAt), type: 'category' })
    }
    const tags = await idsIn(db, 'tags', tagIds)
    for (const t of tags) entries.push({ url: absoluteUrl(`/tag/${t.slug}`), updatedAt: toIST(t.updatedAt), type: 'tag' })
    const users = await idsIn(db, 'users', authorIds)
    for (const u of users) entries.push({ url: absoluteUrl(`/author/${u.slug}`), updatedAt: toIST(u.updatedAt), type: 'author' })

    const pages = await db.find({ collection: 'pages', where: PUBLISHED, pagination: false, depth: 0, ...PUBLIC })
    for (const p of pages.docs) entries.push({ url: absoluteUrl(`/${p.slug}`), updatedAt: toIST(p.updatedAt), type: 'page' })

    const videos = await db.find({ collection: 'videos', where: PUBLISHED, pagination: false, depth: 0, ...PUBLIC })
    for (const v of videos.docs) {
      entries.push({ url: absoluteUrl(`/video/${v.slug}`), updatedAt: toIST(v.updatedAt), type: 'video' })
    }

    const epapers = await db.find({ collection: 'epapers', pagination: false, depth: 0, ...PUBLIC })
    for (const e of epapers.docs) {
      entries.push({ url: absoluteUrl(`/e-paper/${e.date}`), updatedAt: toIST(e.updatedAt), type: 'epaper' })
    }
    return entries
  }),
)

async function idsIn(db: Db, collection: 'tags' | 'users', ids: Set<number>) {
  const list = [...ids].filter((id) => id > 0)
  if (list.length === 0) return []
  const res = await db.find({
    collection,
    where: { id: { in: list } },
    pagination: false,
    depth: 0,
    ...PUBLIC,
  })
  return res.docs.map((d) => ({ slug: d.slug, updatedAt: d.updatedAt }))
}

/** Articles published in the last `hours` (news sitemap, contract §2). Google allows 1000 URLs. */
export const listRecentForNews = cache(async (hours = 48): Promise<ArticleCard[]> => {
  if (!Number.isSafeInteger(hours) || hours < 1 || hours > 720) {
    throw new BadRequestError('hours must be an integer from 1 to 720.')
  }
  return cachedRead(['news', String(hours)], [cacheTags.feeds], async () => {
    const db = await getDb()
    const ctx = await mapContext(db)
    const since = new Date(ctx.now.getTime() - hours * 3_600_000).toISOString()
    const res = await db.find({
      collection: 'articles',
      where: { and: [PUBLISHED, { publishedAt: { greater_than_equal: since } }] },
      sort: NEWEST_FIRST,
      limit: 1000,
      depth: 1,
      ...PUBLIC,
    })
    return res.docs.map((d) => toArticleCard(d, ctx)).filter(nonNull)
  })
})
