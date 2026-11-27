import { AuthApiError, currentAppUser, db } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'
import { unregisterDevice } from '@/lib/push/devices'
import { isExpoPushToken } from '@/lib/push/rules'

/** POST /api/v1/push/devices/unregister { token } → { ok: true } (contract §8). Called on sign-out. */
export async function POST(request: Request): Promise<Response> {
  try {
    const current = await currentAppUser(request.headers)
    if (!current) throw new AuthApiError(401, 'UNAUTHORIZED', 'Please sign in again.')
    const body = await readBody(request)
    if (!isExpoPushToken(body.token)) throw new AuthApiError(422, 'VALIDATION', 'Invalid push token.')
    await unregisterDevice(await db(), current.id, body.token)
    return authJson(200, { ok: true })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
