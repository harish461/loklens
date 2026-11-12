/**
 * Draft preview helper (contract principles: "Draft preview uses separate helpers"). Unlike the public
 * helpers in ./read.ts it reads the latest draft version, is never cached, and runs with the viewer's
 * own access rules — a reporter can preview their own drafts (and published articles), editors anything.
 * Not exported from the `@/lib/data` barrel on purpose.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import type { User } from '@/payload-types'

import { BRAND_FALLBACK_IMAGE, asFallback, toArticle, toImage } from './serialize'
import type { Article } from './types'

export type PreviewResult =
  | { ok: true; article: Article; status: string; createdBy: number | null }
  | { ok: false; reason: 'not-found' | 'incomplete' }

export async function getArticlePreview(id: number, user: User): Promise<PreviewResult> {
  if (!Number.isSafeInteger(id) || id < 1) return { ok: false, reason: 'not-found' }
  const db = await getPayload({ config })
  const doc = await db.findByID({
    collection: 'articles',
    id,
    depth: 2,
    draft: true,
    overrideAccess: false,
    user,
    disableErrors: true,
  })
  if (!doc) return { ok: false, reason: 'not-found' }

  const settings = await db.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: false })
  const ctx = { defaultImage: asFallback(toImage(settings.defaultImage, BRAND_FALLBACK_IMAGE)), now: new Date() }
  // A draft may not have a category yet; the article page needs one for its URL and breadcrumb.
  const article = toArticle(doc, ctx, [])
  if (!article) return { ok: false, reason: 'incomplete' }
  const createdBy = typeof doc.createdBy === 'object' && doc.createdBy ? doc.createdBy.id : (doc.createdBy ?? null)
  return { ok: true, article, status: String(doc.workflowStatus ?? doc._status ?? 'draft'), createdBy }
}
