import type { CollectionConfig } from 'payload'

import { isAdmin, type MaybeUser } from '../access/roles'

/**
 * One row per Expo push token (api-contract §8). Written only by /api/v1/push/* (server-side, after checking
 * the reader's session) and by the push jobs; never through Payload's REST/GraphQL API. Admins can look.
 *
 * Preferences live on the device so one reader can keep the phone on and a tablet quiet.
 */
const adminOnly = ({ req }: { req: { user?: unknown } }): boolean => isAdmin(req.user as MaybeUser)

export const PushDevices: CollectionConfig = {
  slug: 'push-devices',
  labels: { singular: 'Push device', plural: 'Push devices' },
  admin: {
    useAsTitle: 'token',
    defaultColumns: ['appUser', 'platform', 'active', 'appVersion', 'lastSeenAt'],
    group: 'Notifications',
    hidden: ({ user }) => !isAdmin(user as MaybeUser),
  },
  access: {
    create: () => false,
    read: adminOnly,
    update: () => false,
    delete: adminOnly,
    admin: adminOnly,
  },
  timestamps: true,
  fields: [
    { name: 'token', type: 'text', required: true, unique: true, index: true, maxLength: 200 },
    { name: 'appUser', type: 'relationship', relationTo: 'app-users', index: true },
    {
      name: 'platform',
      type: 'select',
      required: true,
      options: [
        { label: 'Android', value: 'android' },
        { label: 'iOS', value: 'ios' },
      ],
    },
    { name: 'deviceId', type: 'text', maxLength: 200 },
    { name: 'appVersion', type: 'text', maxLength: 40 },
    { name: 'active', type: 'checkbox', defaultValue: true, index: true },
    { name: 'deactivatedReason', type: 'text', maxLength: 200 },
    { name: 'lastSeenAt', type: 'date' },
    {
      name: 'preferences',
      type: 'group',
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: true },
        { name: 'breaking', type: 'checkbox', defaultValue: true },
        { name: 'general', type: 'checkbox', defaultValue: true },
        // Category IDs the reader switched off; new categories are on by default.
        { name: 'mutedCategories', type: 'json', defaultValue: [] },
      ],
    },
  ],
}
