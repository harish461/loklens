import type { Access, CollectionConfig, FieldAccess } from 'payload'

import { isAdmin, type MaybeUser } from '../access/roles'

/**
 * Mobile app customers (readers). Deliberately separate from `users` (admins, editors, reporters):
 * these accounts have no role, so no staff permission can ever match them.
 *
 * Access:
 * - anyone may register (create)
 * - a signed-in customer reads and updates only their own record
 * - the public never lists customers; admins may view them in /admin
 * - nobody deletes through the API (admins can, in /admin)
 */
const ownRecord: Access = ({ req }) => {
  const user = req.user as MaybeUser & { collection?: string }
  if (!user || user.collection !== 'app-users') return false
  return { id: { equals: user.id } }
}

const adminOnly = ({ req }: { req: { user?: unknown } }): boolean => isAdmin(req.user as MaybeUser)

/** Google account subject ID: server-only, never returned to any client. */
const neverPublic: FieldAccess = () => false

export const AppUsers: CollectionConfig = {
  slug: 'app-users',
  labels: { singular: 'App user', plural: 'App users' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'provider', 'createdAt'],
    group: 'Admin',
    hidden: ({ user }) => !isAdmin(user as MaybeUser),
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 30, // 30 days: readers stay signed in
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    useAPIKey: false,
    forgotPassword: {
      generateEmailHTML: (args) =>
        `<p>लोक Lens न्यूज़ पासवर्ड रीसेट करने के लिए नीचे क्लिक करें:</p><p><a href="https://loklensnews.com/app/reset?token=${args?.token ?? ''}">पासवर्ड बदलें</a></p>`,
      generateEmailSubject: () => 'लोक Lens न्यूज़ — पासवर्ड रीसेट',
    },
  },
  access: {
    create: () => true,
    read: ownRecord,
    update: ownRecord,
    delete: adminOnly,
    admin: adminOnly,
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 80 },
    {
      name: 'provider',
      type: 'select',
      required: true,
      defaultValue: 'password',
      options: [
        { label: 'Password', value: 'password' },
        { label: 'Google', value: 'google' },
      ],
      access: { update: () => false, create: () => false },
      admin: { readOnly: true },
    },
    // Payload's login sessions: internal, never returned to customers or the public (same rule as staff users).
    {
      name: 'sessions',
      type: 'array',
      access: { read: () => false },
      fields: [
        { name: 'id', type: 'text', required: true },
        { name: 'createdAt', type: 'date' },
        { name: 'expiresAt', type: 'date', required: true },
      ],
    },
    {
      name: 'googleSub',
      type: 'text',
      index: true,
      access: { read: neverPublic, update: neverPublic, create: neverPublic },
      admin: { hidden: true },
    },
  ],
  timestamps: true,
}
