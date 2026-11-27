'use server'

/**
 * Server actions for the admin Notifications view. Every action re-checks on the server that the caller is an
 * active admin (the page hiding a button is not a permission). Inputs are validated by lib/push/manual.ts.
 */
import { revalidatePath } from 'next/cache'

import { isAdmin, type MaybeUser } from '@/access'
import { validateManualNotification, type ManualNotificationInput } from '@/lib/push/manual'
import { cancelManualNotification, createManualNotification } from '@/lib/push/manualSend'
import { normalizeStoredPreferences, wantsNotification, type TargetSpec } from '@/lib/push/rules'
import { getSessionUser } from '@/lib/reporter/session'

export type NotificationActionResult = { ok: true; id: number; scheduled: boolean } | { ok: false; errors: string[] }

async function admin() {
  const { payload, user } = await getSessionUser()
  if (!user || user.isActive === false || !isAdmin(user as unknown as MaybeUser)) return null
  return { payload, user }
}

const NOT_ALLOWED = 'Only admins can send notifications.'

/** How many active devices would receive a notification with this type / audience / category. */
export async function estimateAudience(spec: { type: string; audience: string; categoryId?: number | null }): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const s = await admin()
  if (!s) return { ok: false, error: NOT_ALLOWED }
  const type = spec.type === 'breaking' || spec.type === 'article' || spec.type === 'general' ? spec.type : 'general'
  const audience = spec.audience === 'breaking' || spec.audience === 'category' ? spec.audience : 'all'
  const target: TargetSpec = { type, audience, categoryId: Number.isInteger(spec.categoryId) ? spec.categoryId : null }
  let count = 0
  let page = 1
  // Devices are read in pages; preferences are filtered with the same rule the sender uses.
  for (;;) {
    const res = await s.payload.find({
      collection: 'push-devices',
      where: { active: { equals: true } },
      select: { preferences: true },
      limit: 1000,
      page,
      depth: 0,
      overrideAccess: true,
    })
    count += res.docs.filter((d) => wantsNotification(normalizeStoredPreferences(d.preferences), target)).length
    if (!res.hasNextPage) break
    page++
  }
  return { ok: true, count }
}

/** Creates a manual notification (validated here, created by lib/push/manualSend.ts). */
export async function createNotification(input: ManualNotificationInput): Promise<NotificationActionResult> {
  const s = await admin()
  if (!s) return { ok: false, errors: [NOT_ALLOWED] }
  const checked = validateManualNotification(input)
  if (!checked.ok) return { ok: false, errors: checked.errors }
  try {
    const res = await createManualNotification(s.payload, s.user.id, checked.value)
    if (!res.ok) return res
    revalidatePath('/admin/notifications')
    return { ok: true, id: res.id, scheduled: res.scheduled }
  } catch (err) {
    s.payload.logger.error({ err }, '[push] could not create notification')
    return { ok: false, errors: ['Could not create the notification. Please try again.'] }
  }
}

/** Cancels a scheduled notification that has not started sending. */
export async function cancelNotification(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await admin()
  if (!s) return { ok: false, error: NOT_ALLOWED }
  const res = await cancelManualNotification(s.payload, Number(id))
  if (res.ok) revalidatePath('/admin/notifications')
  return res
}
