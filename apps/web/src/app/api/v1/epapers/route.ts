import { listEPapers } from '@/lib/data'

import { numberParam, preflight, v1Get } from '../_lib/http'

/** GET /api/v1/epapers → Paginated<EPaper> (contract §2). Params: page, pageSize. */
export const GET = v1Get(async (query) =>
  listEPapers({ page: numberParam(query, 'page'), pageSize: numberParam(query, 'pageSize') }),
)
export const OPTIONS = preflight
