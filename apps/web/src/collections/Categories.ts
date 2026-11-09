import type { CollectionConfig } from 'payload'

import { anyone, editorsOnly } from '../access'
import { seoGroup } from '../fields/common'
import { slugField } from '../fields/slug'
import { normalizeCollectionData } from '../hooks/normalize'
import { categoryRevalidation } from '../hooks/revalidate'
import { validateCategorySlug } from '../lib/slug/validate'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Category', plural: 'Categories' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'order', 'showInNav'], group: 'Taxonomy' },
  defaultSort: 'order',
  access: { read: anyone, create: editorsOnly, update: editorsOnly, delete: editorsOnly },
  hooks: {
    beforeValidate: [normalizeCollectionData],
    afterChange: categoryRevalidation.afterChange,
    afterDelete: categoryRevalidation.afterDelete,
  },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Hindi name, e.g. "प्रदेश".' } },
    slugField({
      from: 'name',
      validate: validateCategorySlug,
      description: 'URL: /{slug}. Latin, e.g. "pradesh". Reserved route names are not allowed.',
    }),
    { name: 'description', type: 'textarea', maxLength: 500 },
    { name: 'order', type: 'number', defaultValue: 0, index: true, admin: { position: 'sidebar' } },
    { name: 'showInNav', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
    {
      name: 'color',
      type: 'text',
      admin: { position: 'sidebar', description: 'Accent colour, hex e.g. #C41D17 (brand red).' },
      validate: (value: unknown) =>
        value === undefined || value === null || value === '' || /^#[0-9a-fA-F]{6}$/.test(String(value))
          ? true
          : 'Use a 6-digit hex colour like #C41D17.',
    },
    {
      name: 'legacyPath',
      type: 'text',
      admin: { position: 'sidebar', description: 'Old site path, e.g. /pardesh.php (reference for redirects).' },
    },
    seoGroup(),
  ],
}
