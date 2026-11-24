import { APP_USERS, AuthApiError, assertEmail, assertPassword, db, toAppUser } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'

/** POST /api/v1/auth/register → 201 { token, user } (contract §7). */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readBody(request)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 80) throw new AuthApiError(422, 'VALIDATION', 'कृपया अपना नाम लिखें।')
    const email = assertEmail(body.email)
    const password = assertPassword(body.password)
    const payload = await db()
    await payload.create({ collection: APP_USERS, data: { name, email, password, provider: 'password' }, overrideAccess: true })
    const result = await payload.login({ collection: APP_USERS, data: { email, password }, overrideAccess: true })
    return authJson(201, { token: result.token, user: toAppUser(result.user as unknown as Record<string, unknown>) })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
