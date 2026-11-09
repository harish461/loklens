import type { CollectionConfig } from 'payload'

import { anyone, editorsOnly } from '../access'
import { slugField } from '../fields/slug'
import { normalizeCollectionData } from '../hooks/normalize'

/** District / town. Data only at launch; location pages are deferred (architecture §9). */
export const Locations: CollectionConfig = {
  slug: 'locations',
  labels: { singular: 'Location', plural: 'Locations' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'district', 'slug'], group: 'Taxonomy' },
  access: { read: anyone, create: editorsOnly, update: editorsOnly, delete: editorsOnly },
  hooks: { beforeValidate: [normalizeCollectionData] },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Hindi, e.g. "हल्द्वानी".' } },
    slugField({ from: 'name' }),
    { name: 'district', type: 'text', admin: { description: 'Hindi district name, e.g. "नैनीताल".' } },
  ],
}
