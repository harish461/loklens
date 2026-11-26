import type { CollectionConfig } from 'payload'

import { isAdmin, type MaybeUser } from '../access/roles'

/**
 * Reader interactions with a notification, reported by the app (api-contract §8). Today only "opened" (a tap).
 * One "opened" per (notification, device) is counted, so a repeated report does not inflate the numbers.
 */
const adminOnly = ({ req }: { req: { user?: unknown } }): boolean => isAdmin(req.user as MaybeUser)

export const PushEvents: CollectionConfig = {
  slug: 'push-events',
  labels: { singular: 'Push event', plural: 'Push events' },
  admin: { group: 'Notifications', hidden: true },
  access: {
    create: () => false,
    read: adminOnly,
    update: () => false,
    delete: adminOnly,
    admin: adminOnly,
  },
  timestamps: true,
  fields: [
    { name: 'notification', type: 'relationship', relationTo: 'push-notifications', required: true, index: true },
    { name: 'device', type: 'relationship', relationTo: 'push-devices', index: true },
    { name: 'appUser', type: 'relationship', relationTo: 'app-users' },
    { name: 'type', type: 'select', required: true, defaultValue: 'opened', options: ['opened'] },
    // `${notificationId}:${deviceId or userId}:opened` — unique, so a tap is counted once.
    { name: 'dedupeKey', type: 'text', unique: true, index: true, maxLength: 120 },
  ],
}
