import { AuthApiError, currentAppUser, db } from '@/lib/auth/appUsers'
import { authFail, authJson, authPreflight, readBody } from '@/lib/auth/respond'
import { incrementCounters } from '@/lib/push/send'
import { isExpoPushToken } from '@/lib/push/rules'

/**
 * POST /api/v1/push/events { notificationId, token?, type: 'opened' } → { ok: true } (contract §8).
 * A tap is counted once per notification and device (or user, when the app has no token yet).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const current = await currentAppUser(request.headers)
    if (!current) throw new AuthApiError(401, 'UNAUTHORIZED', 'Please sign in again.')
    const body = await readBody(request)
    const notificationId = Number(body.notificationId)
    if (!Number.isInteger(notificationId) || notificationId <= 0) throw new AuthApiError(422, 'VALIDATION', 'Invalid notification.')
    if (body.type !== 'opened') throw new AuthApiError(422, 'VALIDATION', 'Invalid event type.')

    const payload = await db()
    const notification = await payload.findByID({ collection: 'push-notifications', id: notificationId, depth: 0, overrideAccess: true }).catch(() => null)
    if (!notification) throw new AuthApiError(404, 'NOT_FOUND', 'Notification not found.')

    // Only a device of this user counts as the device; anything else falls back to the user.
    let deviceId: number | null = null
    if (isExpoPushToken(body.token)) {
      const found = await payload.find({
        collection: 'push-devices',
        where: { and: [{ token: { equals: body.token } }, { appUser: { equals: current.id } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      deviceId = found.docs[0]?.id ?? null
    }
    const who = deviceId ? `d${deviceId}` : `u${current.id}`
    try {
      await payload.create({
        collection: 'push-events',
        data: { notification: notificationId, device: deviceId, appUser: current.id, type: 'opened', dedupeKey: `${notificationId}:${who}:opened` },
        overrideAccess: true,
      })
      await incrementCounters(payload, notificationId, { opened: 1 })
    } catch {
      // Already counted (unique dedupeKey): a repeated report is fine.
    }
    return authJson(200, { ok: true })
  } catch (err) {
    return authFail(err)
  }
}

export const OPTIONS = authPreflight
