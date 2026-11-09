import type { CollectionConfig } from 'payload'

import { anyone, editorsOnly } from '../access'
import { slugField } from '../fields/slug'
import { normalizeCollectionData } from '../hooks/normalize'
import { tagRevalidation } from '../hooks/revalidate'

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Tag', plural: 'Tags' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug'], group: 'Taxonomy' },
  access: { read: anyone, create: editorsOnly, update: editorsOnly, delete: editorsOnly },
  hooks: {
    beforeValidate: [normalizeCollectionData],
    afterChange: tagRevalidation.afterChange,
    afterDelete: tagRevalidation.afterDelete,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField({ from: 'name', description: 'URL: /tag/{slug}.' }),
  ],
}
