import { AuthApiError, currentAppUser, db } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'
import { listCategories } from '@/lib/data'
import { ownDevice, savePreferences, toDeviceView } from '@/lib/push/devices'
import { isExpoPushToken, parsePreferences } from '@/lib/push/rules'

const categoryList = async () => (await listCategories()).map((c) => ({ id: c.id, name: c.name, slug: c.slug }))

/** GET /api/v1/push/preferences?token=… → { preferences, categories } (contract §8). */
export async function GET(request: Request): Promise<Response> {
  try {
    const current = await currentAppUser(request.headers)
    if (!current) throw new AuthApiError(401, 'UNAUTHORIZED', 'Please sign in again.')
    const token = new URL(request.url).searchParams.get('token')
    if (!isExpoPushToken(token)) throw new AuthApiError(422, 'VALIDATION', 'Invalid push token.')
    const device = await ownDevice(await db(), current.id, token)
    return authJson(200, { preferences: toDeviceView(device).preferences, categories: await categoryList() })
  } catch (err) {
    return authFail(err)
  }
}

/** POST /api/v1/push/preferences { token, preferences } → { preferences } (contract §8). */
export async function POST(request: Request): Promise<Response> {
  try {
    const current = await currentAppUser(request.headers)
    if (!current) throw new AuthApiError(401, 'UNAUTHORIZED', 'Please sign in again.')
    const body = await readBody(request)
    if (!isExpoPushToken(body.token)) throw new AuthApiError(422, 'VALIDATION', 'Invalid push token.')
    const preferences = parsePreferences(body.preferences)
    if (!preferences) throw new AuthApiError(422, 'VALIDATION', 'Invalid preferences.')
    const saved = await savePreferences(await db(), current.id, body.token, preferences)
    return authJson(200, { preferences: saved })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
