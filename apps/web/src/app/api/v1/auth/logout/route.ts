import { APP_USERS, AuthApiError, currentAppUser, db, sessionIdFromToken } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight } from '@/lib/auth/respond'

/** POST /api/v1/auth/logout → { ok: true }. Removes this device's session, so its token stops working. */
export async function POST(request: Request): Promise<Response> {
  try {
    const current = await currentAppUser(request.headers)
    if (!current) throw new AuthApiError(401, 'UNAUTHORIZED', 'कृपया फिर से साइन इन करें।')
    const sid = sessionIdFromToken(current.token)
    if (sid) {
      const payload = await db()
      const sessions = (current.doc.sessions as { id: string }[] | undefined) ?? []
      await payload.update({
        collection: APP_USERS,
        id: current.id,
        data: { sessions: sessions.filter((s) => s.id !== sid) },
        overrideAccess: true,
      })
    }
    return authJson(200, { ok: true })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
