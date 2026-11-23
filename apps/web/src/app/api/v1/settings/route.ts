import { getSiteSettings } from '@/lib/data'

import { preflight, v1Get } from '../_lib/http'

/** GET /api/v1/settings → SiteSettings incl. navigation (contract §2). */
export const GET = v1Get(async () => getSiteSettings())
export const OPTIONS = preflight
