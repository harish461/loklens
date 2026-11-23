import { listCategories } from '@/lib/data'

import { preflight, v1Get } from '../_lib/http'

/** GET /api/v1/categories → Category[] (contract §2). */
export const GET = v1Get(async () => listCategories())
export const OPTIONS = preflight
