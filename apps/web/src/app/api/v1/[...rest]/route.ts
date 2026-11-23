import { notFound, preflight } from '../_lib/http'

/** Any other /api/v1/* path → 404 in the contract's ApiError shape (contract §3). */
export function GET(): Response {
  return notFound('Unknown API endpoint.')
}
export const OPTIONS = preflight
