import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import {
  articleCreate,
  articleDelete,
  articleUpdate,
  editorialFlagField,
  publishedOrStaff,
  staffOnly,
} from '../access'
import { createdByField, seoGroup } from '../fields/common'
import { richTextField } from '../fields/richText'
import { slugField } from '../fields/slug'
import {
  applyPublishDefaults,
  guardReporterChanges,
  requireFeaturedImageOnPublish,
} from '../hooks/articles'
import { normalizeCollectionData } from '../hooks/normalize'
import { revalidateArticleAfterChange, revalidateArticleAfterDelete } from '../hooks/revalidate'

/** Runs before validation so publishedAt / breakingUntil exist when the document is validated. */
const publishDefaults: CollectionBeforeValidateHook = ({ data, originalDoc }) =>
  data ? applyPublishDefaults(data, originalDoc as Record<string, unknown> | undefined) : data

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: { singular: 'Article', plural: 'Articles' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', '_status', 'publishedAt', 'isBreaking', 'deleteRow'],
    listSearchableFields: ['title', 'summary', 'slug'],
    group: 'Content',
    // Draft preview (architecture §4). The /api/preview route enables draftMode after checking the secret.
    preview: (doc) =>
      doc?.id
        ? `${siteUrl()}/api/preview?collection=articles&id=${doc.id}&secret=${encodeURIComponent(
            process.env.PREVIEW_SECRET ?? '',
          )}`
        : null,
    components: {
      views: {
        list: {
          Component: '@/components/admin/ArticlesListView#ArticlesListView',
        },
        edit: {
          default: {
            Component: '@/components/admin/ArticleEditView#ArticleEditView',
          },
        },
      },
    },
  },
  defaultSort: '-publishedAt',
  access: {
    read: publishedOrStaff,
    readVersions: staffOnly,
    create: articleCreate,
    update: articleUpdate,
    delete: articleDelete,
  },
  versions: {
    maxPerDoc: 50,
    drafts: { schedulePublish: { timeFormat: 'HH:mm', timeIntervals: 15 } },
  },
  hooks: {
    beforeValidate: [normalizeCollectionData, publishDefaults],
    beforeChange: [guardReporterChanges, requireFeaturedImageOnPublish],
    afterChange: [revalidateArticleAfterChange],
    afterDelete: [revalidateArticleAfterDelete],
  },
  fields: [
    // Virtual column: a trash icon per row in the list view (no database column).
    {
      name: 'deleteRow',
      type: 'ui',
      label: 'Delete',
      admin: { components: { Cell: '@/components/admin/DeleteRowCell#DeleteRowCell' } },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 200,
      admin: { description: 'Hindi headline. Keep it under ~110 characters for Google.' },
    },
    slugField({ from: 'title' }),
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      maxLength: 300,
      admin: { description: '1–2 lines. Used on cards, as meta description and in the app.' },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      // Payload skips required checks for drafts, so this is enforced on publish only.
      required: true,
      admin: { description: 'Required to publish; at least 1200 px wide.' },
    },
    richTextField('body', true),
    {
      type: 'row',
      fields: [
        { name: 'category', type: 'relationship', relationTo: 'categories', required: true, index: true },
        { name: 'location', type: 'relationship', relationTo: 'locations', index: true },
      ],
    },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true, index: true },
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: { description: 'Leave empty for the "LokLens News Team" byline.' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' },
        description: 'Set automatically on first publish; editable.',
      },
    },
    {
      type: 'collapsible',
      label: 'Editorial flags',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'isBreaking',
          type: 'checkbox',
          defaultValue: false,
          index: true,
          access: { create: editorialFlagField, update: editorialFlagField },
        },
        {
          name: 'breakingUntil',
          type: 'date',
          access: { create: editorialFlagField, update: editorialFlagField },
          admin: {
            date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' },
            description: 'Defaults to publish time + 6 h. A background job clears "Breaking" afterwards.',
            condition: (data) => Boolean(data?.isBreaking),
          },
        },
        {
          name: 'isTrending',
          type: 'checkbox',
          defaultValue: false,
          index: true,
          access: { create: editorialFlagField, update: editorialFlagField },
        },
        {
          name: 'isFeatured',
          type: 'checkbox',
          defaultValue: false,
          index: true,
          access: { create: editorialFlagField, update: editorialFlagField },
        },
      ],
    },
    seoGroup({ withImage: true, withNoindex: true }),
    createdByField(),
  ],
}
