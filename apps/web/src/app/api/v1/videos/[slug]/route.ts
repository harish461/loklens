import { getVideo } from '@/lib/data'

import { preflight, v1Get } from '../../_lib/http'

/** GET /api/v1/videos/{slug} → Video (contract §2); unknown or unpublished → 404. */
export const GET = v1Get<{ slug: string }>(async (_query, { slug }) => getVideo(slug), {
  notFoundMessage: 'Video not found.',
})
export const OPTIONS = preflight
