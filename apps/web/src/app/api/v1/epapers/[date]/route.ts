import { getEPaper } from '@/lib/data'

import { preflight, v1Get } from '../../_lib/http'

/** GET /api/v1/epapers/{date} → EPaper (contract §2); unknown or unpublished → 404. */
export const GET = v1Get<{ date: string }>(async (_query, { date }) => getEPaper(date), {
  notFoundMessage: 'E-paper not found.',
})
export const OPTIONS = preflight
