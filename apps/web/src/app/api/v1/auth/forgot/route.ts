import { APP_USERS, assertEmail, db } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'

/**
 * POST /api/v1/auth/forgot { email } → { ok: true } always, so the response never reveals whether an
 * account exists. Payload sends the reset email (link to the website's reset page).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readBody(request)
    const email = assertEmail(body.email)
    try {
      const payload = await db()
      await payload.forgotPassword({ collection: APP_USERS, data: { email }, overrideAccess: true })
    } catch (err) {
      console.error('[LokLens auth] forgot-password email failed:', err)
    }
    return authJson(200, { ok: true })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
