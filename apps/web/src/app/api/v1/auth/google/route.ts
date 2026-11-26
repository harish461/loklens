import { APP_USERS, AuthApiError, db, randomPassword, toAppUser } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'
import { configuredAudiences, GoogleTokenError, verifyGoogleIdentityToken } from '@/lib/auth/google'

/**
 * POST /api/v1/auth/google { idToken } → { token, user } (contract §7).
 *
 * - The ID token is verified locally against Google's signing keys (signature, issuer, audience, expiry,
 *   verified email). Only the Web client ID is accepted as audience.
 * - A customer is found by Google subject; if none, one is created in `app-users`.
 * - An email that already belongs to a password account is NOT linked automatically (that would let anyone
 *   who controls a Google account take over a password account). The customer signs in with the password.
 * - Google accounts have no usable password: a fresh random one is set on each Google sign-in, so the only
 *   way in is Google again.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readBody(request)
    if (typeof body.idToken !== 'string' || !body.idToken) throw new AuthApiError(422, 'VALIDATION', 'Google token missing.')
    if (configuredAudiences().length === 0) throw new AuthApiError(500, 'SERVER_ERROR', 'Google sign-in is not configured.')

    let identity
    try {
      identity = await verifyGoogleIdentityToken(body.idToken)
    } catch (err) {
      if (err instanceof GoogleTokenError) {
        // The client only gets the generic message; the reason (error code, public client IDs) is for the log.
        console.warn(`[LokLens auth] Google token rejected: ${err.reason}`)
        throw new AuthApiError(401, 'UNAUTHORIZED', 'Google sign-in could not be verified.')
      }
      throw err
    }

    const payload = await db()
    const bySub = await payload.find({
      collection: APP_USERS,
      where: { googleSub: { equals: identity.sub } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    let doc = bySub.docs[0] as unknown as Record<string, unknown> | undefined
    if (!doc) {
      const byEmail = await payload.find({
        collection: APP_USERS,
        where: { email: { equals: identity.email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (byEmail.docs[0]) {
        throw new AuthApiError(409, 'CONFLICT', 'यह ईमेल पासवर्ड से पंजीकृत है। कृपया पासवर्ड से साइन इन करें।')
      }
      doc = (await payload.create({
        collection: APP_USERS,
        data: { name: identity.name, email: identity.email, password: randomPassword(), provider: 'google', googleSub: identity.sub },
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
    }

    const password = randomPassword()
    await payload.update({ collection: APP_USERS, id: doc.id as number, data: { password }, overrideAccess: true })
    const result = await payload.login({ collection: APP_USERS, data: { email: identity.email, password }, overrideAccess: true })
    return authJson(200, { token: result.token, user: toAppUser(result.user as unknown as Record<string, unknown>) })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
