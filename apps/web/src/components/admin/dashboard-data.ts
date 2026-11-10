/**
 * Read-only numbers for the admin dashboard. Server-only; no collections, fields or hooks are changed.
 * Every query goes through the Payload local API with the signed-in user, so a user only sees counts for
 * what their role can read (overrideAccess: false). Days are IST calendar days, matching the site.
 */
import type { Payload, TypedUser, Where } from 'payload'

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

export type DashboardData = {
  period: Period
  stats: StatCard[]
  chart: { days: string[]; values: number[]; breakingDays: string[] }
  donut: { name: string; count: number }[]
  donutTotal: number
  latest: LatestArticle[]
  activity: { id: number; title: string; updatedAt: string; editHref: string }[]
  hasData: boolean
}

function clampPeriod(p: number | undefined): Period {
  return (PERIOD_OPTIONS as readonly number[]).includes(p ?? 0) ? (p as Period) : 30
}

/** Category label from a relationship that may be an id or a populated doc. */
function categoryName(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in value) return String((value as { name: unknown }).name)
  return '—'
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

  // Donut: published articles by category.
  const categories = await ctx.payload.find({
    collection: 'categories',
    limit: 100,
    depth: 0,
    pagination: false,
    ...acc(ctx),
  })
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
  const donut = categories.docs
    .map((c) => ({ name: String(c.name), count: perCategory.get(c.id) ?? 0 }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
  const donutTotal = donut.reduce((sum, d) => sum + d.count, 0)

  // Latest and recently changed articles (drafts included, so editors see work in progress).
  const recent = await ctx.payload.find({
    collection: 'articles',
    sort: '-updatedAt',
    limit: 6,
    depth: 1,
    draft: true,
    ...acc(ctx),
  })
  const latest: LatestArticle[] = recent.docs.map((d) => {
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

  return {
    period,
    stats,
    chart: {
      days: keys,
      values: keys.map((k) => series.get(k) ?? 0),
      breakingDays: breakingDays.filter((d) => keys.includes(d)),
    },
    donut,
    donutTotal,
    latest,
    activity,
    hasData: publishedStats.total + draftStats.total + videoStats.total + userStats.total > 0,
  }
}
