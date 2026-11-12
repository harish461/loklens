import { currentWorkflowStatus, sameId } from '@/access'
import type { ArticleFormInitial } from '@/components/reporter/ArticleForm'
import type { Article, Media } from '@/payload-types'

import { mediaThumbUrl } from './queries'

const idOf = (v: unknown): number | null =>
  typeof v === 'number' ? v : v && typeof v === 'object' && 'id' in v ? Number((v as { id: unknown }).id) : null

export const EMPTY_ARTICLE: ArticleFormInitial = {
  title: '',
  summary: '',
  slug: '',
  category: null,
  location: null,
  tags: [],
  featuredImage: null,
  body: undefined,
  seo: { metaTitle: '', metaDescription: '', focusKeyword: '' },
  articleType: 'news',
  language: 'hi',
  featureRequested: false,
  status: 'draft',
  reviewNote: null,
}

/** Stored article (depth ≥ 1) → the form's initial values. */
export function toFormInitial(doc: Article, userId: number): ArticleFormInitial {
  const img = doc.featuredImage && typeof doc.featuredImage === 'object' ? (doc.featuredImage as Media) : null
  return {
    id: doc.id,
    title: doc.title ?? '',
    summary: doc.summary ?? '',
    slug: doc.slug ?? '',
    category: idOf(doc.category),
    location: idOf(doc.location),
    tags: (doc.tags ?? []).map(idOf).filter((x): x is number => x !== null),
    featuredImage: img
      ? {
          id: img.id,
          url: img.sizes?.card?.url ?? mediaThumbUrl(img) ?? '',
          alt: img.alt ?? '',
          caption: img.caption ?? '',
          own: sameId(idOf(img.createdBy), userId),
        }
      : null,
    body: doc.body,
    seo: {
      metaTitle: doc.seo?.metaTitle ?? '',
      metaDescription: doc.seo?.metaDescription ?? '',
      focusKeyword: doc.seo?.focusKeyword ?? '',
    },
    articleType: doc.articleType ?? 'news',
    language: doc.language ?? 'hi',
    featureRequested: Boolean(doc.featureRequested),
    status: currentWorkflowStatus(doc as unknown as Record<string, unknown>),
    reviewNote: doc.reviewNote ?? null,
  }
}
