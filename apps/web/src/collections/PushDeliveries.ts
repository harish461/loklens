import type { CollectionConfig } from 'payload'

import { isAdmin, type MaybeUser } from '../access/roles'

/**
 * One row per (notification, device): the Expo push ticket and, later, its receipt. Lets the receipt job find
 * tickets to check and lets the admin count accepted / failed / handed-over messages truthfully.
 */
const adminOnly = ({ req }: { req: { user?: unknown } }): boolean => isAdmin(req.user as MaybeUser)

export const DELIVERY_STATUSES = ['accepted', 'ticket_error', 'receipt_ok', 'receipt_error'] as const

export const PushDeliveries: CollectionConfig = {
  slug: 'push-deliveries',
  labels: { singular: 'Push delivery', plural: 'Push deliveries' },
  admin: {
    defaultColumns: ['notification', 'device', 'status', 'errorCode', 'createdAt'],
    group: 'Notifications',
    hidden: true,
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
    { name: 'notification', type: 'relationship', relationTo: 'push-notifications', required: true, index: true },
    { name: 'device', type: 'relationship', relationTo: 'push-devices', required: true, index: true },
    { name: 'ticketId', type: 'text', index: true, maxLength: 100 },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      options: DELIVERY_STATUSES.map((s) => ({ label: s, value: s })),
    },
    { name: 'errorCode', type: 'text', maxLength: 80 },
    { name: 'errorMessage', type: 'text', maxLength: 300 },
    { name: 'receiptCheckedAt', type: 'date' },
  ],
}
