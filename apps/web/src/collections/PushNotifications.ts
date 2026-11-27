import type { CollectionConfig } from 'payload'

import { isAdmin, type MaybeUser } from '../access/roles'

/**
 * One row per notification (manual or automatic on publish). Created by the admin Notifications screen and the
 * article publish hook, sent by the `pushSend` job. Counters are written by the jobs; the admin screen reads
 * them. `dedupeKey` is unique, so an article can never create a second automatic notification.
 */
const adminOnly = ({ req }: { req: { user?: unknown } }): boolean => isAdmin(req.user as MaybeUser)

export const NOTIFICATION_TYPES = ['article', 'breaking', 'general'] as const
export const NOTIFICATION_STATUSES = ['scheduled', 'queued', 'sending', 'sent', 'failed', 'cancelled'] as const

export const PushNotifications: CollectionConfig = {
  slug: 'push-notifications',
  labels: { singular: 'Notification', plural: 'Notifications' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'status', 'sentAt', 'targeted', 'accepted', 'opened'],
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
  defaultSort: '-createdAt',
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 120 },
    { name: 'body', type: 'textarea', required: true, maxLength: 240 },
    { name: 'imageUrl', type: 'text', maxLength: 500 },
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Article', value: 'article' },
        { label: 'Breaking news', value: 'breaking' },
        { label: 'General update', value: 'general' },
      ],
    },
    {
      name: 'audience',
      type: 'select',
      required: true,
      defaultValue: 'all',
      options: [
        { label: 'All opted-in readers', value: 'all' },
        { label: 'Breaking news subscribers', value: 'breaking' },
        { label: 'Category subscribers', value: 'category' },
      ],
    },
    { name: 'category', type: 'relationship', relationTo: 'categories', index: true },
    { name: 'article', type: 'relationship', relationTo: 'articles', index: true },
    { name: 'source', type: 'select', required: true, defaultValue: 'manual', options: ['manual', 'publish'] },
    { name: 'dedupeKey', type: 'text', unique: true, index: true, maxLength: 120 },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      options: NOTIFICATION_STATUSES.map((s) => ({ label: s, value: s })),
    },
    { name: 'scheduledAt', type: 'date' },
    { name: 'sentAt', type: 'date', index: true },
    { name: 'createdBy', type: 'relationship', relationTo: 'users' },
    // Fan-out cursor: the last push-devices ID already sent to (the send job works in slices).
    { name: 'cursor', type: 'number', defaultValue: 0 },
    { name: 'error', type: 'text', maxLength: 500 },
    // Counters (written by the jobs).
    { name: 'targeted', type: 'number', defaultValue: 0 },
    { name: 'accepted', type: 'number', defaultValue: 0 },
    { name: 'failed', type: 'number', defaultValue: 0 },
    { name: 'handedOver', type: 'number', defaultValue: 0 },
    { name: 'receiptFailed', type: 'number', defaultValue: 0 },
    { name: 'opened', type: 'number', defaultValue: 0 },
  ],
}
