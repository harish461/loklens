import { getTag } from '@/lib/data'

import { preflight, v1Get } from '../../_lib/http'

/** GET /api/v1/tags/{slug} → TagRef (contract §2); unknown or unpublished → 404. */
export const GET = v1Get<{ slug: string }>(async (_query, { slug }) => getTag(slug), {
  notFoundMessage: 'Tag not found.',
})
export const OPTIONS = preflight
