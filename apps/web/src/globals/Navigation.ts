import type { Field, GlobalConfig } from 'payload'

import { adminsOnly, anyone } from '../access'
import { validateUrlOrPath } from '../fields/common'
import { normalizeGlobalData } from '../hooks/normalize'
import { revalidateGlobal } from '../hooks/revalidate'
import { cacheTags } from '../lib/revalidate/tags'

const navItemFields: Field[] = [
  { name: 'label', type: 'text', required: true },
  { name: 'url', type: 'text', required: true, validate: (v: unknown) => validateUrlOrPath(v) },
]

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Navigation',
  admin: { group: 'Settings' },
  access: { read: anyone, update: adminsOnly },
  hooks: {
    beforeValidate: [normalizeGlobalData],
    afterChange: [revalidateGlobal([cacheTags.settings, cacheTags.home])],
  },
  fields: [
    {
      name: 'header',
      type: 'array',
      maxRows: 15,
      admin: { description: 'Header menu. Leave empty to use categories with "show in nav".' },
      fields: navItemFields,
    },
    {
      name: 'footer',
      type: 'array',
      maxRows: 6,
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'items', type: 'array', maxRows: 15, fields: navItemFields },
      ],
    },
  ],
}
