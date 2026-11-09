import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { adminField, adminsOnly, anyone, userPrivateField, userUpdate, ROLES } from '../access'
import { slugField } from '../fields/slug'
import { normalizeCollectionData } from '../hooks/normalize'
import { userRevalidation } from '../hooks/revalidate'

/** The very first account (created from /admin "create first user") becomes an admin. */
const firstUserIsAdmin: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || !data) return data
  const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })
  if (totalDocs === 0) return { ...data, role: 'admin' }
  return data
}

export const SOCIAL_PLATFORMS = ['facebook', 'x', 'instagram', 'youtube', 'linkedin', 'whatsapp', 'website'] as const

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'User', plural: 'Users' },
  auth: {
    tokenExpiration: 60 * 60 * 8, // 8 h editor session
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    useAPIKey: false,
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'displayName', 'email', 'role'],
    group: 'Admin',
  },
  access: {
    // Public read exposes byline fields only (email/role are field-protected). Needed for author pages.
    read: anyone,
    create: adminsOnly,
    update: userUpdate,
    delete: adminsOnly,
    admin: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeValidate: [normalizeCollectionData, firstUserIsAdmin],
    afterChange: userRevalidation.afterChange,
    afterDelete: userRevalidation.afterDelete,
  },
  fields: [
    // Overrides Payload's built-in auth email field (merged by name): private to admins and self.
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      access: { read: userPrivateField },
    },
    { name: 'name', type: 'text', required: true, admin: { description: 'Full name (used in admin).' } },
    {
      name: 'displayName',
      type: 'text',
      admin: { description: 'Hindi byline, e.g. "राहुल नेगी". Falls back to name.' },
    },
    slugField({ from: 'name', description: 'Author page URL: /author/{slug}. Generated from the name.' }),
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'reporter',
      saveToJWT: true,
      options: ROLES.map((r) => ({ label: r[0].toUpperCase() + r.slice(1), value: r })),
      access: { read: userPrivateField, create: adminField, update: adminField },
      admin: { position: 'sidebar' },
    },
    // Payload's own auth field (merged by name): live session ids are internal, admins only.
    {
      name: 'sessions',
      type: 'array',
      access: { read: adminField },
      fields: [
        { name: 'id', type: 'text', required: true },
        { name: 'createdAt', type: 'date' },
        { name: 'expiresAt', type: 'date', required: true },
      ],
    },
    { name: 'bio', type: 'textarea', maxLength: 600 },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    {
      name: 'social',
      type: 'array',
      maxRows: 8,
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: SOCIAL_PLATFORMS.map((p) => ({ label: p, value: p })),
        },
        { name: 'url', type: 'text', required: true },
      ],
    },
  ],
}
