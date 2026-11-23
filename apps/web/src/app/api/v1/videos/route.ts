import { listVideos } from '@/lib/data'

import { numberParam, preflight, v1Get } from '../_lib/http'

/** GET /api/v1/videos → Paginated<Video> (contract §2). Params: page, pageSize. */
export const GET = v1Get(async (query) =>
  listVideos({ page: numberParam(query, 'page'), pageSize: numberParam(query, 'pageSize') }),
)
export const OPTIONS = preflight
