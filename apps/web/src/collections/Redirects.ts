import type { CollectionConfig, FieldHook } from 'payload'

import { adminsOnly, anyone } from '../access'
import { validateUrlOrPath } from '../fields/common'
import { redirectRevalidation } from '../hooks/revalidate'

/** Normalises an old-site path: trims, ensures a leading "/", drops a trailing slash (not root). */
export function normalizeFromPath(value: unknown): unknown {
  if (typeof value !== 'string') return value
  let v = value.trim()
  try {
    if (/^https?:\/\//i.test(v)) {
      const u = new URL(v)
      v = `${u.pathname}${u.search}`
    }
  } catch {
    /* keep as typed */
  }
  if (!v.startsWith('/')) v = `/${v}`
  if (v.length > 1) v = v.replace(/\/+(?=$|\?)/, '')
  return v
}

const normalizeFrom: FieldHook = ({ value }) => normalizeFromPath(value)

/**
 * Admin-managed exceptions for old URLs (architecture §6). Read by the /legacy resolver;
 * anything not listed there returns 410.
 */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  labels: { singular: 'Redirect', plural: 'Redirects' },
  admin: { useAsTitle: 'from', defaultColumns: ['from', 'to', 'type'], group: 'Admin' },
  access: { read: anyone, create: adminsOnly, update: adminsOnly, delete: adminsOnly },
  hooks: {
    afterChange: redirectRevalidation.afterChange,
    afterDelete: redirectRevalidation.afterDelete,
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [normalizeFrom] },
      admin: { description: 'Old path incl. query if needed, e.g. /article.php?id=42' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: '301',
      options: [
        { label: '301 – moved permanently', value: '301' },
        { label: '410 – gone', value: '410' },
      ],
    },
    {
      name: 'to',
      type: 'text',
      admin: {
        description: 'New path (e.g. /pradesh/some-story-142) or full URL. Not used for 410.',
        condition: (_, siblingData) => siblingData?.type !== '410',
      },
      validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
        siblingData?.type === '410' ? true : validateUrlOrPath(value),
    },
  ],
}
