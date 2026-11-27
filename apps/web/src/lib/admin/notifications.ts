/**
 * Read side of the admin Notifications view (admins only; the view checks the role first). Every number comes
 * from stored counters or rows, never from estimates:
 * - accepted    = Expo accepted the message (push ticket ok)
 * - handedOver  = Expo's receipt says it was handed to Google/Apple
 * - failed      = ticket errors + receipt errors
 * - opened      = taps reported by the app (once per device)
 * Nothing here is called "delivered": neither Expo nor the platforms confirm that the phone showed it.
 */
import { sql } from '@payloadcms/db-postgres'
import type { Payload, Where } from 'payload'

import { siteBaseUrl } from '@/lib/data/urls'

export interface NotificationStats {
  notificationsSent: number
  activeDevices: number
  targeted: number
  accepted: number
  handedOver: number
  failed: number
  opened: number
  awaitingReceipt: number
}

export interface NotificationRow {
  id: number
  title: string
  body: string
  type: 'article' | 'breaking' | 'general'
  audience: 'all' | 'breaking' | 'category'
  source: 'manual' | 'publish'
  status: string
  categoryName: string | null
  articleTitle: string | null
  createdAt: string
  scheduledAt: string | null
  sentAt: string | null
  targeted: number
  accepted: number
  failed: number
  handedOver: number
  receiptFailed: number
  opened: number
  error: string | null
}

export interface HistoryFilters {
  from?: string
  to?: string
  category?: number
  status?: string
  page?: number
}

export interface FormArticle {
  id: number
  title: string
  summary: string
  categoryId: number | null
  imageUrl: string | null
}

const num = (v: unknown) => Number(v ?? 0) || 0

export async function notificationStats(payload: Payload): Promise<NotificationStats> {
  const totals = (await payload.db.drizzle.execute(sql`
    SELECT
      count(*) FILTER (WHERE "status" = 'sent') AS sent,
      coalesce(sum("targeted"), 0) AS targeted,
      coalesce(sum("accepted"), 0) AS accepted,
      coalesce(sum("handed_over"), 0) AS handed_over,
      coalesce(sum("failed"), 0) + coalesce(sum("receipt_failed"), 0) AS failed,
      coalesce(sum("opened"), 0) AS opened
    FROM "push_notifications"`)) as { rows: Record<string, unknown>[] }
  const t = totals.rows[0] ?? {}
  const [devices, awaiting] = await Promise.all([
    payload.count({ collection: 'push-devices', where: { active: { equals: true } }, overrideAccess: true }),
    payload.count({ collection: 'push-deliveries', where: { status: { equals: 'accepted' } }, overrideAccess: true }),
  ])
  return {
    notificationsSent: num(t.sent),
    activeDevices: devices.totalDocs,
    targeted: num(t.targeted),
    accepted: num(t.accepted),
    handedOver: num(t.handed_over),
    failed: num(t.failed),
    opened: num(t.opened),
    awaitingReceipt: awaiting.totalDocs,
  }
}

const relTitle = (v: unknown, key: 'name' | 'title'): string | null =>
  v && typeof v === 'object' && key in v ? String((v as Record<string, unknown>)[key] ?? '') || null : null

export const HISTORY_PAGE_SIZE = 25

export async function notificationHistory(
  payload: Payload,
  filters: HistoryFilters = {},
): Promise<{ rows: NotificationRow[]; page: number; totalPages: number; totalDocs: number }> {
  const and: Where[] = []
  if (filters.from) and.push({ createdAt: { greater_than_equal: filters.from } })
  if (filters.to) and.push({ createdAt: { less_than_equal: filters.to } })
  if (filters.category) and.push({ category: { equals: filters.category } })
  if (filters.status) and.push({ status: { equals: filters.status } })
  const res = await payload.find({
    collection: 'push-notifications',
    where: and.length ? { and } : undefined,
    sort: '-createdAt',
    limit: HISTORY_PAGE_SIZE,
    page: filters.page && filters.page > 0 ? filters.page : 1,
    depth: 1,
    overrideAccess: true,
  })
  return {
    page: res.page ?? 1,
    totalPages: res.totalPages,
    totalDocs: res.totalDocs,
    rows: res.docs.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      audience: n.audience,
      source: n.source,
      status: n.status,
      categoryName: relTitle(n.category, 'name'),
      articleTitle: relTitle(n.article, 'title'),
      createdAt: n.createdAt,
      scheduledAt: n.scheduledAt ?? null,
      sentAt: n.sentAt ?? null,
      targeted: n.targeted ?? 0,
      accepted: n.accepted ?? 0,
      failed: n.failed ?? 0,
      handedOver: n.handedOver ?? 0,
      receiptFailed: n.receiptFailed ?? 0,
      opened: n.opened ?? 0,
      error: n.error ?? null,
    })),
  }
}

/** Categories and the latest published articles for the form's pickers. */
export async function notificationFormOptions(payload: Payload): Promise<{ categories: { id: number; name: string }[]; articles: FormArticle[] }> {
  const [categories, articles] = await Promise.all([
    payload.find({ collection: 'categories', sort: 'order', limit: 100, depth: 0, pagination: false, overrideAccess: true }),
    payload.find({
      collection: 'articles',
      where: { _status: { equals: 'published' } },
      sort: '-publishedAt',
      limit: 40,
      depth: 1,
      overrideAccess: true,
    }),
  ])
  const base = siteBaseUrl()
  return {
    categories: categories.docs.map((c) => ({ id: c.id, name: c.name })),
    articles: articles.docs.map((a) => {
      const media = a.featuredImage && typeof a.featuredImage === 'object' ? a.featuredImage : null
      const path = media?.sizes?.card?.url || media?.url || null
      const imageUrl = path ? (/^https?:\/\//.test(path) ? path : base ? `${base}${path}` : null) : null
      return {
        id: a.id,
        title: a.title,
        summary: a.summary ?? '',
        categoryId: typeof a.category === 'object' && a.category ? a.category.id : (a.category ?? null),
        imageUrl: imageUrl && imageUrl.startsWith('https://') ? imageUrl : null,
      }
    }),
  }
}
