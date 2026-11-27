/**
 * Permanent deletion of a reader account (api-contract §7, required by Google Play for apps with sign-up).
 * Called only after the route has checked the session (and the password for password accounts).
 *
 * Order matters: linked rows first, the account last. If anything fails part-way, the account still exists and
 * a retry finishes the job; deleting the account first would leave orphaned personal data behind.
 */
import type { Payload } from 'payload'

import { APP_USERS } from './appUsers'

export interface DeletionSummary {
  devices: number
  deliveries: number
  events: number
}

/** `confirm` must be exactly "DELETE" (typed by the reader), so an accidental tap never deletes an account. */
export const isDeleteConfirmation = (value: unknown): boolean => value === 'DELETE'

export async function deleteAppUserAccount(payload: Payload, userId: number): Promise<DeletionSummary> {
  const devices = await payload.find({
    collection: 'push-devices',
    where: { appUser: { equals: userId } },
    limit: 1000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const deviceIds = devices.docs.map((d) => d.id)

  let deliveries = 0
  let events = 0
  if (deviceIds.length) {
    const del = await payload.delete({ collection: 'push-deliveries', where: { device: { in: deviceIds } }, overrideAccess: true })
    deliveries = del.docs.length
  }
  const ev = await payload.delete({
    collection: 'push-events',
    where: deviceIds.length ? { or: [{ appUser: { equals: userId } }, { device: { in: deviceIds } }] } : { appUser: { equals: userId } },
    overrideAccess: true,
  })
  events = ev.docs.length
  if (deviceIds.length) {
    await payload.delete({ collection: 'push-devices', where: { id: { in: deviceIds } }, overrideAccess: true })
  }
  // The account last; its sessions are stored on the record and go with it.
  await payload.delete({ collection: APP_USERS, id: userId, overrideAccess: true })
  return { devices: deviceIds.length, deliveries, events }
}
