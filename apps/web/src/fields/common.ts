import type { Field, FieldHook, GroupField, RelationshipField } from 'payload'

import { internalField } from '../access'

interface SeoOptions {
  withImage?: boolean
  withNoindex?: boolean
  withFocusKeyword?: boolean
}

/** Optional SEO overrides; fallbacks are resolved by the read helpers (contract §1). */
export function seoGroup({ withImage = false, withNoindex = false, withFocusKeyword = false }: SeoOptions = {}): GroupField {
  const fields: Field[] = [
    { name: 'metaTitle', type: 'text', maxLength: 70, admin: { description: 'Defaults to the title.' } },
    {
      name: 'metaDescription',
      type: 'textarea',
      maxLength: 200,
      admin: { description: 'Defaults to the summary / description.' },
    },
  ]
  if (withImage) {
    fields.push({
      name: 'ogImage',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Defaults to the featured image.' },
    })
  }
  if (withFocusKeyword) {
    fields.push({
      name: 'focusKeyword',
      type: 'text',
      maxLength: 100,
      admin: { description: 'Main search phrase this article targets (editorial hint only).' },
    })
  }
  if (withNoindex) {
    fields.push({
      name: 'noindex',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Hide this page from search engines.' },
    })
  }
  return { name: 'seo', type: 'group', label: 'SEO', fields }
}

/** Keeps createdBy = the creating user; clients can never set or change it. */
const stampCreatedBy: FieldHook = ({ operation, req, originalDoc, value }) => {
  if (operation === 'create') return req.user?.id ?? value ?? null
  return (originalDoc as { createdBy?: unknown } | undefined)?.createdBy ?? value ?? null
}

/** Internal owner field used by access rules; hidden from the public API. */
export function createdByField(): RelationshipField {
  return {
    name: 'createdBy',
    type: 'relationship',
    relationTo: 'users',
    index: true,
    access: { read: internalField },
    hooks: { beforeChange: [stampCreatedBy] },
    admin: { position: 'sidebar', readOnly: true },
  }
}

/** Basic http(s) URL / site path check used by nav, redirects and settings. */
export function validateUrlOrPath(value: unknown, { allowEmpty = false } = {}): true | string {
  if (value === undefined || value === null || value === '') return allowEmpty ? true : 'Required.'
  if (typeof value !== 'string') return 'Must be text.'
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:') return true
  } catch {
    /* fall through */
  }
  return 'Use a site path starting with "/" or a full http(s) URL.'
}
