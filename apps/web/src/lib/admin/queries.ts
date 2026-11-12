/**
 * Read helpers for the admin Review Queue and Reporters views. Run as the signed-in editor/admin
 * (overrideAccess: false). `draft: true` so reviewers see the latest submitted version.
 */
import type { Payload } from 'payload'

import { currentWorkflowStatus, type WorkflowStatus } from '@/access'
import { mediaThumbUrl } from '@/lib/reporter/queries'
import type { Article, Category, User } from '@/payload-types'

type As = { user: User; overrideAccess: false }

export interface ReviewItem {
  id: number
  title: string
  summary: string
  status: WorkflowStatus
  categoryName: string | null
  reporterName: string
  thumbUrl: string | null
  submittedAt: string | null
  updatedAt: string
  reviewedAt: string | null
  reviewNote: string | null
  featureRequested: boolean
  hasImage: boolean
}

const nameOf = (u: unknown) =>
  u && typeof u === 'object' ? String((u as User).displayName || (u as User).name || (u as User).email || '—') : '—'

function toItem(doc: Article): ReviewItem {
  const cat = typeof doc.category === 'object' && doc.category ? (doc.category as Category) : null
  return {
    id: doc.id,
    title: doc.title,
    summary: doc.summary ?? '',
    status: currentWorkflowStatus(doc as unknown as Record<string, unknown>),
    categoryName: cat?.name ?? null,
    reporterName: nameOf(doc.createdBy),
    thumbUrl: mediaThumbUrl(doc.featuredImage),
    submittedAt: doc.submittedAt ?? null,
    updatedAt: doc.updatedAt,
    reviewedAt: doc.reviewedAt ?? null,
    reviewNote: doc.reviewNote ?? null,
    featureRequested: Boolean(doc.featureRequested),
    hasImage: Boolean(doc.featuredImage),
  }
}

export async function reviewQueue(payload: Payload, as: As) {
  const [pending, rejected] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: { workflowStatus: { equals: 'pending_review' } },
      sort: 'submittedAt',
      limit: 100,
      depth: 1,
      draft: true,
      ...as,
    }),
    payload.find({
      collection: 'articles',
      where: { workflowStatus: { equals: 'rejected' } },
      sort: '-reviewedAt',
      limit: 20,
      depth: 1,
      draft: true,
      ...as,
    }),
  ])
  return { pending: pending.docs.map(toItem), rejected: rejected.docs.map(toItem), pendingTotal: pending.totalDocs }
}

export interface ReporterRow {
  id: number
  name: string
  displayName: string
  email: string
  mobile: string
  designation: string
  isActive: boolean
  canPublish: boolean
  assignedCategories: { id: number; name: string }[]
  lastLogin: string | null
  lastSubmission: string | null
  counts: Record<WorkflowStatus | 'total', number>
  recent: { id: number; title: string; status: WorkflowStatus; updatedAt: string }[]
}

export async function reportersOverview(payload: Payload, as: As) {
  const [users, categories] = await Promise.all([
    payload.find({ collection: 'users', where: { role: { equals: 'reporter' } }, sort: 'name', depth: 1, pagination: false, ...as }),
    payload.find({ collection: 'categories', sort: 'order', depth: 0, pagination: false, ...as }),
  ])
  const ids = users.docs.map((u) => u.id)
  const articles = ids.length
    ? await payload.find({
        collection: 'articles',
        where: { createdBy: { in: ids } },
        sort: '-updatedAt',
        depth: 0,
        limit: 5000,
        draft: true,
        ...as,
      })
    : { docs: [] as Article[] }

  const byReporter = new Map<number, Article[]>()
  for (const a of articles.docs as Article[]) {
    const owner = typeof a.createdBy === 'object' && a.createdBy ? a.createdBy.id : a.createdBy
    if (typeof owner !== 'number') continue
    byReporter.set(owner, [...(byReporter.get(owner) ?? []), a])
  }

  const rows: ReporterRow[] = (users.docs as User[]).map((u) => {
    const mine = byReporter.get(u.id) ?? []
    const counts = { total: mine.length, draft: 0, pending_review: 0, rejected: 0, published: 0 }
    for (const a of mine) counts[currentWorkflowStatus(a as unknown as Record<string, unknown>)]++
    const submitted = mine.map((a) => a.submittedAt).filter((d): d is string => Boolean(d)).sort()
    const sessions = (u.sessions ?? []).map((x) => x.createdAt).filter((d): d is string => Boolean(d)).sort()
    return {
      id: u.id,
      name: u.name,
      displayName: u.displayName ?? '',
      email: u.email,
      mobile: u.mobile ?? '',
      designation: u.designation ?? '',
      isActive: u.isActive !== false,
      canPublish: Boolean(u.canPublish),
      assignedCategories: (u.assignedCategories ?? [])
        .filter((c): c is Category => typeof c === 'object' && c !== null)
        .map((c) => ({ id: c.id, name: c.name })),
      // Payload keeps only live sessions, so this is the latest login that is still signed in.
      lastLogin: sessions.at(-1) ?? null,
      lastSubmission: submitted.at(-1) ?? null,
      counts,
      recent: mine.slice(0, 5).map((a) => ({
        id: a.id,
        title: a.title,
        status: currentWorkflowStatus(a as unknown as Record<string, unknown>),
        updatedAt: a.updatedAt,
      })),
    }
  })

  return { rows, categories: categories.docs.map((c: Category) => ({ id: c.id, name: c.name })) }
}
