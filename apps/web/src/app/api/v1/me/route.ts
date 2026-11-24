import { AuthApiError, currentAppUser, toAppUser } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight } from '@/lib/auth/respond'

/** GET /api/v1/me → { user } for a valid customer token (contract §7). */
export async function GET(request: Request): Promise<Response> {
  try {
    const current = await currentAppUser(request.headers)
    if (!current) throw new AuthApiError(401, 'UNAUTHORIZED', 'कृपया फिर से साइन इन करें।')
    return authJson(200, { user: toAppUser(current.doc) })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
