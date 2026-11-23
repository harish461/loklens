import { getArticle } from '@/lib/data'

import { idParam, preflight, v1Get } from '../../_lib/http'

/** GET /api/v1/articles/{id} → Article; unknown, unpublished or non-numeric id → 404 (contract §2–§3). */
export const GET = v1Get<{ id: string }>(
  async (_query, { id }) => {
    const articleId = idParam(id)
    return articleId === null ? null : getArticle(articleId)
  },
  { notFoundMessage: 'Article not found.' },
)
export const OPTIONS = preflight
