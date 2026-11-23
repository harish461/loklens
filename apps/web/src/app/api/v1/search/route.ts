import { search } from '@/lib/data'

import { numberParam, preflight, v1Get } from '../_lib/http'

/**
 * GET /api/v1/search?q= → Paginated<ArticleCard> (contract §2). q is 2–100 characters (missing or out of
 * range → 400). Not cached server-side; the edge caches it for 30 s (contract §3).
 */
export const GET = v1Get(
  async (query) =>
    search({
      q: query.get('q') as string,
      page: numberParam(query, 'page'),
      pageSize: numberParam(query, 'pageSize'),
    }),
  { cache: 'search' },
)
export const OPTIONS = preflight
