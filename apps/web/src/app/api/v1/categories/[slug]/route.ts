import { getCategory } from '@/lib/data'

import { preflight, v1Get } from '../../_lib/http'

/** GET /api/v1/categories/{slug} → Category (contract §2); unknown or unpublished → 404. */
export const GET = v1Get<{ slug: string }>(async (_query, { slug }) => getCategory(slug), {
  notFoundMessage: 'Category not found.',
})
export const OPTIONS = preflight
