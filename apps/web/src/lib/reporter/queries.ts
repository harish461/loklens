/**
 * Read helpers for the reporter workspace. Every query is scoped to `createdBy = me` AND runs with the
 * reporter's own access rules (overrideAccess: false), so even a bug in the filter cannot leak other
 * reporters' drafts. Reads use `draft: true` so the reporter sees their latest saved version. Never cached.
 */
import type { Where } from 'payload'

import { WORKFLOW_STATUSES, currentWorkflowStatus, isWorkflowStatus, type WorkflowStatus } from '@/access'
import type { Article, Category, Location, Media, Tag } from '@/payload-types'

import { asReporter, type ReporterSession } from './session'

export const PAGE_SIZE = 10

export interface ReporterArticleRow {
  id: number
  title: string
  slug: string
  status: WorkflowStatus
  categoryName: string | null
  thumbUrl: string | null
  createdAt: string
  updatedAt: string
  reviewNote: string | null
  everPublished: boolean
}

export interface ArticleListParams {
  q?: string
  category?: string
  status?: string
  sort?: 'latest' | 'oldest'
  page?: number
}

/** Media → the smallest useful URL (thumb size, else original). */
export function mediaThumbUrl(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null
  const m = media as Media
  return m.sizes?.thumb?.url ?? m.url ?? null
}

function toRow(doc: Article): ReporterArticleRow {
  const category = typeof doc.category === 'object' && doc.category ? (doc.category as Category) : null
  return {
    id: doc.id,
    title: doc.title,
    slug: doc.slug ?? '',
    status: currentWorkflowStatus(doc as unknown as Record<string, unknown>),
    categoryName: category?.name ?? null,
    thumbUrl: mediaThumbUrl(doc.featuredImage),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    reviewNote: doc.reviewNote ?? null,
    everPublished: Boolean(doc.everPublished),
  }
}

const mine = (session: ReporterSession): Where => ({ createdBy: { equals: session.user.id } })

/** Normalises untrusted search params. */
export function parseListParams(raw: Record<string, string | string[] | undefined>): Required<ArticleListParams> {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const page = Number.parseInt(one(raw.page), 10)
  const status = one(raw.status)
  return {
    q: one(raw.q).trim().slice(0, 120),
    category: /^\d+$/.test(one(raw.category)) ? one(raw.category) : '',
    status: isWorkflowStatus(status) ? status : '',
    sort: one(raw.sort) === 'oldest' ? 'oldest' : 'latest',
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1000) : 1,
  }
}

export async function listMyArticles(session: ReporterSession, params: ArticleListParams) {
  const and: Where[] = [mine(session)]
  if (params.q) and.push({ title: { like: params.q } })
  if (params.category) and.push({ category: { equals: Number(params.category) } })
  if (params.status) and.push({ workflowStatus: { equals: params.status } })
  const res = await session.payload.find({
    collection: 'articles',
    where: { and },
    sort: params.sort === 'oldest' ? 'createdAt' : '-createdAt',
    page: params.page ?? 1,
    limit: PAGE_SIZE,
    depth: 1,
    draft: true,
    ...asReporter(session),
  })
  return {
    rows: res.docs.map(toRow),
    page: res.page ?? 1,
    totalPages: Math.max(1, res.totalPages),
    totalDocs: res.totalDocs,
  }
}

export async function myStats(session: ReporterSession): Promise<Record<WorkflowStatus | 'total', number>> {
  const countOf = async (status?: WorkflowStatus) => {
    const where: Where = status ? { and: [mine(session), { workflowStatus: { equals: status } }] } : mine(session)
    // find (not count) so `draft: true` reads the latest version, like the list does.
    const res = await session.payload.find({
      collection: 'articles',
      where,
      limit: 1,
      depth: 0,
      draft: true,
      ...asReporter(session),
    })
    return res.totalDocs
  }
  const [total, ...byStatus] = await Promise.all([countOf(), ...WORKFLOW_STATUSES.map((s) => countOf(s))])
  return Object.fromEntries([['total', total], ...WORKFLOW_STATUSES.map((s, i) => [s, byStatus[i]])]) as Record<
    WorkflowStatus | 'total',
    number
  >
}

/** One of my articles (latest draft version), or null if it isn't mine / doesn't exist. */
export async function getMyArticle(session: ReporterSession, id: number): Promise<Article | null> {
  if (!Number.isSafeInteger(id) || id < 1) return null
  const res = await session.payload.find({
    collection: 'articles',
    where: { and: [mine(session), { id: { equals: id } }] },
    limit: 1,
    depth: 1,
    draft: true,
    ...asReporter(session),
  })
  return res.docs[0] ?? null
}

/** Options for the article form. Categories are limited to the reporter's assignment, if any. */
export async function formOptions(session: ReporterSession) {
  const { payload } = session
  const opts = { depth: 0, pagination: false, ...asReporter(session) } as const
  const assigned = (session.user.assignedCategories ?? []).map((c) => (typeof c === 'object' ? c.id : c))
  const [categories, tags, locations, media] = await Promise.all([
    payload.find({
      collection: 'categories',
      sort: 'order',
      ...(assigned.length ? { where: { id: { in: assigned } } } : {}),
      ...opts,
    }),
    payload.find({ collection: 'tags', sort: 'name', limit: 500, ...opts }),
    payload.find({ collection: 'locations', sort: 'name', ...opts }),
    payload.find({
      collection: 'media',
      where: { createdBy: { equals: session.user.id } },
      sort: '-createdAt',
      limit: 40,
      depth: 0,
      ...asReporter(session),
    }),
  ])
  return {
    categories: categories.docs.map((c: Category) => ({ id: c.id, name: c.name })),
    tags: tags.docs.map((t: Tag) => ({ id: t.id, name: t.name })),
    locations: locations.docs.map((l: Location) => ({ id: l.id, name: l.name })),
    media: media.docs.map((m: Media) => ({
      id: m.id,
      url: mediaThumbUrl(m) ?? '',
      alt: m.alt,
      caption: m.caption ?? '',
    })),
  }
}

export type FormOptions = Awaited<ReturnType<typeof formOptions>>
