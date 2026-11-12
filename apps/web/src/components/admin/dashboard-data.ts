/**
 * Read-only numbers and merged CMS records for the admin dashboard and article views.
 * Server-only; no collections, fields or hooks are changed.
 * Every query goes through the Payload local API with the signed-in user, so a user only sees counts for
 * what their role can read (overrideAccess: false). Days are IST calendar days, matching the site.
 */
import type { Payload, TypedUser, Where } from 'payload'

import {
  type AdminArticleItem,
  type ArticleWorkflowStatus,
} from './mock-cms-data'

export const PERIOD_OPTIONS = [7, 30, 90] as const
export type Period = (typeof PERIOD_OPTIONS)[number]

const DAY_MS = 86_400_000
const IST_OFFSET_MS = 330 * 60_000
const SPARK_DAYS = 14
const MAX_ROWS = 5000

export type Ctx = { payload: Payload; user: TypedUser | null | undefined }

/** IST calendar day as YYYY-MM-DD. */
export function istDayKey(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** The last `days` IST day keys, oldest first. */
function dayKeys(days: number, now: number): string[] {
  return Array.from({ length: days }, (_, i) => istDayKey(now - (days - 1 - i) * DAY_MS))
}

function acc(ctx: Ctx) {
  return { overrideAccess: false as const, user: ctx.user ?? undefined }
}

type Counted = 'articles' | 'videos' | 'users'

async function count(ctx: Ctx, collection: Counted, where?: Where, draft = false): Promise<number> {
  const res = await ctx.payload.find({ collection, where, draft, limit: 1, depth: 0, ...acc(ctx) })
  return res.totalDocs
}

/** Counts for the whole collection, the last `days` days and the `days` before that, on one date field. */
async function windowed(
  ctx: Ctx,
  collection: Counted,
  field: 'publishedAt' | 'createdAt',
  days: number,
  extra: Where[] = [],
  draft = false,
) {
  const now = Date.now()
  const start = new Date(now - days * DAY_MS).toISOString()
  const start2 = new Date(now - 2 * days * DAY_MS).toISOString()
  const base = extra.length ? { and: extra } : undefined
  const total = await count(ctx, collection, base, draft)
  const last = await count(ctx, collection, { and: [...extra, { [field]: { greater_than_equal: start } }] }, draft)
  const prev = await count(
    ctx,
    collection,
    { and: [...extra, { [field]: { greater_than_equal: start2 } }, { [field]: { less_than: start } }] },
    draft,
  )
  return { total, last, prev }
}

/** Daily counts for the last `days` days (IST), from one date field. */
async function dailySeries(
  ctx: Ctx,
  collection: Counted,
  field: 'publishedAt' | 'createdAt',
  days: number,
  extra: Where[] = [],
  draft = false,
): Promise<Map<string, number>> {
  const from = new Date(Date.now() - days * DAY_MS).toISOString()
  const res = await ctx.payload.find({
    collection,
    where: { and: [...extra, { [field]: { greater_than_equal: from } }] },
    limit: MAX_ROWS,
    depth: 0,
    pagination: false,
    draft,
    ...acc(ctx),
  })
  const map = new Map<string, number>()
  for (const doc of res.docs) {
    const value = (doc as unknown as Record<string, unknown>)[field]
    if (typeof value !== 'string') continue
    const key = istDayKey(Date.parse(value))
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export type StatCard = {
  label: string
  href: string
  total: number
  delta: number
  spark: number[]
}

export type LatestArticle = {
  id: number
  title: string
  category: string
  status: 'published' | 'draft' | 'breaking'
  date: string | null
  editHref: string
}

export type DynamicScheduledItem = {
  id: string
  title: string
  category: string
  scheduledTime: string
  scheduledDate: string
  author: string
  status: 'scheduled' | 'in_progress' | 'upcoming'
  editHref: string
}

export type DynamicTaskItem = {
  id: string
  title: string
  subtitle: string
  count: number
  priority: 'high' | 'medium' | 'low'
  href: string
  iconName: 'file-check' | 'message-square' | 'search-alert' | 'image'
}

export type DashboardData = {
  period: Period
  stats: StatCard[]
  chart: {
    days: string[]
    values: number[]
    breakingDays: string[]
    summary: {
      totalPublished: number
      peakDay: number
      activeDays: number
      breakingStories: number
    }
  }
  donut: { name: string; count: number; percentage: number }[]
  donutTotal: number
  latest: LatestArticle[]
  activity: { id: number; title: string; updatedAt: string; editHref: string }[]
  hasData: boolean
  enrichedArticles: AdminArticleItem[]
  scheduledItems: DynamicScheduledItem[]
  pendingTasks: DynamicTaskItem[]
  dbSummary: {
    totalArticles: number
    publishedArticles: number
    draftArticles: number
    breakingArticles: number
    categories: { id: number; name: string; slug: string }[]
    authors: { id: number; name: string; role: string; email?: string }[]
  }
}

function clampPeriod(p: number | undefined): Period {
  return (PERIOD_OPTIONS as readonly number[]).includes(p ?? 0) ? (p as Period) : 30
}

/** Category label from a relationship that may be an id or a populated doc. */
export function categoryName(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in value) return String((value as { name: unknown }).name)
  return 'प्रदेश'
}

export function categorySlugOf(value: unknown): string {
  if (value && typeof value === 'object' && 'slug' in value) return String((value as { slug: unknown }).slug)
  return 'pradesh'
}

export function authorNameOf(authors: unknown): string {
  if (Array.isArray(authors) && authors.length > 0) {
    const first = authors[0]
    if (first && typeof first === 'object') {
      const u = first as { displayName?: unknown; name?: unknown }
      return String(u.displayName || u.name || 'LokLens News Team')
    }
  }
  return 'LokLens News Team'
}

export function mediaUrlOf(media: unknown): string {
  if (media && typeof media === 'object') {
    const m = media as { url?: unknown; sizes?: { thumb?: { url?: unknown }; card?: { url?: unknown } } }
    const thumb = m.sizes?.thumb?.url ?? m.sizes?.card?.url ?? m.url
    if (typeof thumb === 'string' && thumb.trim()) return thumb
  }
  return '/brand/logo-96.webp'
}

/** Real view counter for DB articles (falls back to 0 until external analytics are connected). */
function estimateViews(d: Record<string, unknown>): { views: number; formatted: string } {
  const views = typeof d.views === 'number' ? d.views : 0
  return {
    views,
    formatted: views > 0 ? (views >= 1000 ? `${(views / 1000).toFixed(1)}K` : String(views)) : '—',
  }
}

export function mapPayloadDocToAdminArticle(d: Record<string, unknown>, nowMs = Date.now()): AdminArticleItem {
  const id = Number(d.id ?? 0)
  const rawStatus = d._status === 'published' ? 'published' : 'draft'
  const pubStr = typeof d.publishedAt === 'string' ? d.publishedAt : null
  const pubMs = pubStr ? Date.parse(pubStr) : NaN

  let workflowStatus: ArticleWorkflowStatus = rawStatus
  // Review states come from the stored workflow (architecture §8); "scheduled" stays derived.
  if (d.workflowStatus === 'pending_review' || d.workflowStatus === 'rejected') {
    workflowStatus = d.workflowStatus
  } else if (rawStatus === 'draft' && !Number.isNaN(pubMs) && pubMs > nowMs) {
    workflowStatus = 'scheduled'
  }

  const isBreaking = Boolean(d.isBreaking)
  const isFeatured = Boolean(d.isFeatured)
  const isTrending = Boolean(d.isTrending)
  const catName = categoryName(d.category)
  const catSlug = categorySlugOf(d.category)
  const slug = typeof d.slug === 'string' && d.slug ? d.slug : `article-${id}`
  const { views, formatted } = estimateViews(d)

  const loc = d.location && typeof d.location === 'object' && 'name' in d.location ? String((d.location as { name: unknown }).name) : undefined

  return {
    id: `db-${id}`,
    dbId: id,
    isSample: false,
    title: String(d.title ?? '(बिना शीर्षक लेख)'),
    slug,
    summary: String(d.summary ?? ''),
    category: catName,
    categoryId: typeof d.category === 'object' && d.category && 'id' in d.category ? Number((d.category as { id: unknown }).id) : typeof d.category === 'number' ? d.category : undefined,
    subcategory: loc,
    author: authorNameOf(d.authors),
    publishedAt: pubStr ?? String(d.updatedAt ?? new Date(nowMs).toISOString()),
    updatedAt: String(d.updatedAt ?? new Date(nowMs).toISOString()),
    views,
    viewsFormatted: formatted,
    status: workflowStatus,
    isBreaking,
    isFeatured,
    isTrending,
    thumbnailUrl: mediaUrlOf(d.featuredImage),
    editHref: `/admin/collections/articles/${id}`,
    // Unpublished articles only render on the draft preview page.
    previewHref: rawStatus === 'published' ? `/${catSlug}/${slug}-${id}` : `/preview/${id}`,
    seoScore: 90,
  }
}

export async function getDashboardData(ctx: Ctx, periodRaw?: number): Promise<DashboardData> {
  const period = clampPeriod(periodRaw)
  const now = Date.now()
  const keys = dayKeys(period, now)

  // Stat cards: published articles, drafts, videos, users.
  const publishedStats = await windowed(ctx, 'articles', 'publishedAt', 30)
  const draftStats = await windowed(ctx, 'articles', 'createdAt', 30, [{ _status: { equals: 'draft' } }], true)
  const videoStats = await windowed(ctx, 'videos', 'createdAt', 30)
  const userStats = await windowed(ctx, 'users', 'createdAt', 30)

  const publishedSpark = await dailySeries(ctx, 'articles', 'publishedAt', SPARK_DAYS)
  const draftSpark = await dailySeries(ctx, 'articles', 'createdAt', SPARK_DAYS, [{ _status: { equals: 'draft' } }], true)
  const videoSpark = await dailySeries(ctx, 'videos', 'createdAt', SPARK_DAYS)
  const userSpark = await dailySeries(ctx, 'users', 'createdAt', SPARK_DAYS)
  const sparkOf = (m: Map<string, number>) => dayKeys(SPARK_DAYS, now).map((k) => m.get(k) ?? 0)

  const stats: StatCard[] = [
    {
      label: 'Published articles',
      href: '/admin/collections/articles',
      total: publishedStats.total,
      delta: publishedStats.last - publishedStats.prev,
      spark: sparkOf(publishedSpark),
    },
    {
      label: 'Drafts',
      href: '/admin/collections/articles?where[_status][equals]=draft',
      total: draftStats.total,
      delta: draftStats.last - draftStats.prev,
      spark: sparkOf(draftSpark),
    },
    {
      label: 'Videos',
      href: '/admin/collections/videos',
      total: videoStats.total,
      delta: videoStats.last - videoStats.prev,
      spark: sparkOf(videoSpark),
    },
    {
      label: 'Editors & users',
      href: '/admin/collections/users',
      total: userStats.total,
      delta: userStats.last - userStats.prev,
      spark: sparkOf(userSpark),
    },
  ]

  // Chart: articles published per day, and the days that had a breaking story.
  const series = await dailySeries(ctx, 'articles', 'publishedAt', period)
  const breakingRes = await ctx.payload.find({
    collection: 'articles',
    where: {
      and: [{ isBreaking: { equals: true } }, { publishedAt: { greater_than_equal: new Date(now - period * DAY_MS).toISOString() } }],
    },
    limit: MAX_ROWS,
    depth: 0,
    pagination: false,
    ...acc(ctx),
  })
  const breakingDays = [
    ...new Set(breakingRes.docs.map((d) => (typeof d.publishedAt === 'string' ? istDayKey(Date.parse(d.publishedAt)) : ''))),
  ].filter(Boolean)

  // Categories and Users
  const categories = await ctx.payload.find({
    collection: 'categories',
    limit: 100,
    depth: 0,
    pagination: false,
    ...acc(ctx),
  })
  const usersRes = await ctx.payload.find({
    collection: 'users',
    limit: 100,
    depth: 0,
    pagination: false,
    ...acc(ctx),
  }).catch(() => ({ docs: [] }))

  const articlesByCategory = await ctx.payload.find({
    collection: 'articles',
    limit: MAX_ROWS,
    depth: 0,
    pagination: false,
    ...acc(ctx),
  })
  const perCategory = new Map<number, number>()
  for (const a of articlesByCategory.docs) {
    const id = typeof a.category === 'number' ? a.category : (a.category as { id?: number } | null)?.id
    if (typeof id === 'number') perCategory.set(id, (perCategory.get(id) ?? 0) + 1)
  }
  const donutTotal = categories.docs.reduce((sum, c) => sum + (perCategory.get(c.id) ?? 0), 0)
  const donut = categories.docs
    .map((c) => {
      const count = perCategory.get(c.id) ?? 0
      return {
        name: String(c.name),
        count,
        percentage: donutTotal > 0 ? Math.round((count / donutTotal) * 100) : 0,
      }
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)

  // Latest and recently changed articles (drafts included, so editors see work in progress).
  const recent = await ctx.payload.find({
    collection: 'articles',
    sort: '-updatedAt',
    limit: 50,
    depth: 1,
    draft: true,
    ...acc(ctx),
  })
  const latest: LatestArticle[] = recent.docs.slice(0, 6).map((d) => {
    const status: LatestArticle['status'] =
      d._status === 'draft' ? 'draft' : d.isBreaking ? 'breaking' : 'published'
    return {
      id: d.id,
      title: String(d.title ?? '(untitled)'),
      category: categoryName(d.category),
      status,
      date: typeof d.publishedAt === 'string' ? d.publishedAt : null,
      editHref: `/admin/collections/articles/${d.id}`,
    }
  })
  const activity = recent.docs.slice(0, 5).map((d) => ({
    id: d.id,
    title: String(d.title ?? '(untitled)'),
    updatedAt: String(d.updatedAt),
    editHref: `/admin/collections/articles/${d.id}`,
  }))

  const dbArticles = recent.docs.map((d) => mapPayloadDocToAdminArticle(d as unknown as Record<string, unknown>, now))
  // Purely dynamic DB articles — NO dummy/sample articles
  const enrichedArticles: AdminArticleItem[] = dbArticles

  const scheduledItems: DynamicScheduledItem[] = dbArticles
    .filter((a) => a.status === 'scheduled')
    .map((a) => {
      const pub = new Date(a.publishedAt)
      return {
        id: String(a.id),
        title: a.title,
        category: a.category,
        scheduledTime: !Number.isNaN(pub.getTime())
          ? pub.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' }) +
            ', ' +
            pub.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : 'Scheduled',
        scheduledDate: !Number.isNaN(pub.getTime()) ? pub.toISOString().slice(0, 10) : '',
        author: a.author,
        status: 'scheduled' as const,
        editHref: a.editHref,
      }
    })

  const pendingTasks: DynamicTaskItem[] = []
  if (draftStats.total > 0) {
    pendingTasks.push({
      id: 'task-drafts',
      title: 'प्रकाशन हेतु ड्राफ्ट',
      subtitle: 'संपादकीय समीक्षा एवं अनुमोदन',
      count: draftStats.total,
      priority: 'high',
      href: '/admin/collections/articles?where[_status][equals]=draft',
      iconName: 'file-check',
    })
  }
  if (breakingRes.docs.length > 0) {
    pendingTasks.push({
      id: 'task-breaking',
      title: 'सक्रिय ब्रेकिंग न्यूज़',
      subtitle: 'लाइव टिकर एवं मुख्य अलर्ट',
      count: breakingRes.docs.length,
      priority: 'high',
      href: '/admin/breaking-news',
      iconName: 'search-alert',
    })
  }
  const missingImagesCount = recent.docs.filter((d) => !d.featuredImage).length
  if (missingImagesCount > 0) {
    pendingTasks.push({
      id: 'task-images',
      title: 'बिना मुख्य चित्र के लेख',
      subtitle: 'फीचर्ड इमेज अपलोड अपेक्षित',
      count: missingImagesCount,
      priority: 'medium',
      href: '/admin/collections/articles',
      iconName: 'image',
    })
  }

  const chartValues = keys.map((k) => series.get(k) ?? 0)
  const totalPublished = chartValues.reduce((a, b) => a + b, 0)
  const peakDay = chartValues.length ? Math.max(...chartValues) : 0
  const activeDays = chartValues.filter((v) => v > 0).length

  return {
    period,
    stats,
    chart: {
      days: keys,
      values: chartValues,
      breakingDays: breakingDays.filter((d) => keys.includes(d)),
      summary: {
        totalPublished,
        peakDay,
        activeDays,
        breakingStories: breakingDays.length,
      },
    },
    donut,
    donutTotal,
    latest,
    activity,
    hasData: publishedStats.total + draftStats.total + videoStats.total + userStats.total > 0,
    enrichedArticles,
    scheduledItems,
    pendingTasks,
    dbSummary: {
      totalArticles: publishedStats.total + draftStats.total,
      publishedArticles: publishedStats.total,
      draftArticles: draftStats.total,
      breakingArticles: breakingRes.docs.length,
      categories: categories.docs.map((c) => ({ id: c.id, name: String(c.name), slug: String(c.slug) })),
      authors: usersRes.docs.map((u) => {
        const usr = u as unknown as { id: number; displayName?: string; name?: string; role?: string; email?: string }
        return {
          id: usr.id,
          name: String(usr.displayName || usr.name || usr.email || `User #${usr.id}`),
          role: String(usr.role || 'reporter'),
          email: usr.email,
        }
      }),
    },
  }
}
