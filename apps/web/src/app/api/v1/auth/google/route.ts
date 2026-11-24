import { APP_USERS, AuthApiError, db, randomPassword, toAppUser, verifyGoogleIdToken } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'

/**
 * POST /api/v1/auth/google { idToken } → { token, user } (contract §7).
 * Finds the customer by Google subject, or creates one. An email that already belongs to a password account is
 * not linked automatically (that would let a Google login take over a password account); the user signs in
 * with the password instead. Google accounts never use a password: a fresh random one is set on every sign-in,
 * so the only way in is Google again.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readBody(request)
    if (typeof body.idToken !== 'string' || !body.idToken) throw new AuthApiError(422, 'VALIDATION', 'Google token missing.')
    const claims = await verifyGoogleIdToken(body.idToken)
    const payload = await db()

    const bySub = await payload.find({ collection: APP_USERS, where: { googleSub: { equals: claims.sub } }, limit: 1, depth: 0, overrideAccess: true })
    let doc = bySub.docs[0] as unknown as Record<string, unknown> | undefined
    if (!doc) {
      const byEmail = await payload.find({ collection: APP_USERS, where: { email: { equals: claims.email } }, limit: 1, depth: 0, overrideAccess: true })
      if (byEmail.docs[0]) throw new AuthApiError(409, 'CONFLICT', 'यह ईमेल पासवर्ड से पंजीकृत है। कृपया पासवर्ड से साइन इन करें।')
      doc = (await payload.create({
        collection: APP_USERS,
        data: { name: claims.name, email: claims.email, password: randomPassword(), provider: 'google', googleSub: claims.sub },
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
    }

    const password = randomPassword()
    await payload.update({ collection: APP_USERS, id: doc.id as number, data: { password }, overrideAccess: true })
    const result = await payload.login({ collection: APP_USERS, data: { email: claims.email, password }, overrideAccess: true })
    return authJson(200, { token: result.token, user: toAppUser(result.user as unknown as Record<string, unknown>) })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
