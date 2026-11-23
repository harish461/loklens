import { getAuthor } from '@/lib/data'

import { preflight, v1Get } from '../../_lib/http'

/** GET /api/v1/authors/{slug} → Author (contract §2); unknown or unpublished → 404. */
export const GET = v1Get<{ slug: string }>(async (_query, { slug }) => getAuthor(slug), {
  notFoundMessage: 'Author not found.',
})
export const OPTIONS = preflight
