import { AuthApiError, currentAppUser, db } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'
import { registerDevice } from '@/lib/push/devices'
import { isExpoPushToken, isPlatform, shortText } from '@/lib/push/rules'

/** POST /api/v1/push/devices { token, platform, deviceId?, appVersion? } → { device } (contract §8). */
export async function POST(request: Request): Promise<Response> {
  try {
    const current = await currentAppUser(request.headers)
    if (!current) throw new AuthApiError(401, 'UNAUTHORIZED', 'Please sign in again.')
    const body = await readBody(request)
    if (!isExpoPushToken(body.token)) throw new AuthApiError(422, 'VALIDATION', 'Invalid push token.')
    if (!isPlatform(body.platform)) throw new AuthApiError(422, 'VALIDATION', 'Invalid platform.')
    const device = await registerDevice(await db(), current.id, {
      token: body.token,
      platform: body.platform,
      deviceId: shortText(body.deviceId, 200),
      appVersion: shortText(body.appVersion, 40),
    })
    return authJson(200, { device })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
