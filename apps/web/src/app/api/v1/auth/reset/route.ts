import { APP_USERS, AuthApiError, assertPassword, db } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'

/** POST /api/v1/auth/reset { token, password } → { ok: true } (contract §7). */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readBody(request)
    if (typeof body.token !== 'string' || !body.token) throw new AuthApiError(422, 'VALIDATION', 'रीसेट लिंक अधूरा है।')
    const password = assertPassword(body.password)
    try {
      const payload = await db()
      await payload.resetPassword({ collection: APP_USERS, data: { token: body.token, password }, overrideAccess: true })
    } catch {
      // Payload reports an unknown or expired token; the client only needs to know it did not work.
      throw new AuthApiError(422, 'VALIDATION', 'यह रीसेट लिंक अमान्य है या समाप्त हो चुका है।')
    }
    return authJson(200, { ok: true })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
