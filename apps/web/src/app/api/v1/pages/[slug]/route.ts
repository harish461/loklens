import { getPage } from '@/lib/data'

import { preflight, v1Get } from '../../_lib/http'

/** GET /api/v1/pages/{slug} → Page (contract §2); unknown or unpublished → 404. */
export const GET = v1Get<{ slug: string }>(async (_query, { slug }) => getPage(slug), {
  notFoundMessage: 'Page not found.',
})
export const OPTIONS = preflight
