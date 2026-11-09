import type { CollectionConfig } from 'payload'

import { adminsOnly, publishedOrStaff, staffOnly } from '../access'
import { createdByField, seoGroup } from '../fields/common'
import { richTextField } from '../fields/richText'
import { slugField } from '../fields/slug'
import { normalizeCollectionData } from '../hooks/normalize'
import { pageRevalidation } from '../hooks/revalidate'

/** Static pages expected at launch (architecture §2/§3). Others may be added. */
export const STANDARD_PAGES = [
  'about',
  'contact',
  'advertise',
  'privacy-policy',
  'terms',
  'editorial-policy',
  'corrections-policy',
  'disclaimer',
] as const

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status', 'updatedAt'], group: 'Content' },
  // Policy pages carry legal weight: admins only (architecture §8 "admin: everything").
  access: { read: publishedOrStaff, readVersions: staffOnly, create: adminsOnly, update: adminsOnly, delete: adminsOnly },
  versions: { maxPerDoc: 20, drafts: true },
  hooks: {
    beforeValidate: [normalizeCollectionData],
    afterChange: pageRevalidation.afterChange,
    afterDelete: pageRevalidation.afterDelete,
  },
  fields: [
    { name: 'title', type: 'text', required: true, admin: { description: 'Hindi title, e.g. "हमारे बारे में".' } },
    slugField({
      from: 'title',
      description: `URL: /{slug}. Standard pages: ${STANDARD_PAGES.join(', ')}.`,
    }),
    richTextField('body', true),
    seoGroup({ withImage: true, withNoindex: true }),
    createdByField(),
  ],
}
