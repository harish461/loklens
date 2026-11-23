import { getHome } from '@/lib/data'

import { preflight, v1Get } from '../_lib/http'

/** GET /api/v1/home → Home (contract §2). */
export const GET = v1Get(async () => getHome())
export const OPTIONS = preflight
