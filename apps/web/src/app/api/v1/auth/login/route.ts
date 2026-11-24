import { APP_USERS, AuthApiError, assertEmail, db, toAppUser } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'

/** POST /api/v1/auth/login → { token, user } (contract §7). Lockout after 5 failures is Payload's. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readBody(request)
    const email = assertEmail(body.email)
    if (typeof body.password !== 'string' || !body.password) throw new AuthApiError(422, 'VALIDATION', 'पासवर्ड लिखें।')
    const payload = await db()
    const result = await payload.login({ collection: APP_USERS, data: { email, password: body.password }, overrideAccess: true })
    return authJson(200, { token: result.token, user: toAppUser(result.user as unknown as Record<string, unknown>) })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
