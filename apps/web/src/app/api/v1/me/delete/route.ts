import { APP_USERS, AuthApiError, currentAppUser, db } from '@/lib/auth/appUsers'
import { deleteAppUserAccount, isDeleteConfirmation } from '@/lib/auth/deleteAccount'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'

/**
 * POST /api/v1/me/delete { confirm: 'DELETE', password? } → { ok: true } (contract §7).
 * The account comes from the session, never from the body. Password accounts must re-enter the password
 * (wrong attempts count towards Payload's 5-attempt lock); Google accounts have no usable password.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const current = await currentAppUser(request.headers)
    if (!current) throw new AuthApiError(401, 'UNAUTHORIZED', 'Please sign in again.')
    const body = await readBody(request)
    if (!isDeleteConfirmation(body.confirm)) throw new AuthApiError(422, 'VALIDATION', 'Type DELETE to confirm.')

    const payload = await db()
    if (current.doc.provider !== 'google') {
      if (typeof body.password !== 'string' || !body.password) throw new AuthApiError(422, 'VALIDATION', 'पासवर्ड लिखें।')
      // Throws AuthenticationError (→ 401) or LockedAuth (→ 429), mapped by authFail.
      await payload.login({ collection: APP_USERS, data: { email: String(current.doc.email), password: body.password }, overrideAccess: true })
    }

    const summary = await deleteAppUserAccount(payload, current.id)
    payload.logger.info(`[account] reader ${current.id} deleted their account (${summary.devices} device(s), ${summary.events} event(s))`)
    return authJson(200, { ok: true })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
