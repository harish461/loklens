import type { CollectionConfig, FieldHook } from 'payload'

import { editorsOnly, publishedOrStaff, staffOnly } from '../access'
import { createdByField } from '../fields/common'
import { slugField } from '../fields/slug'
import { normalizeCollectionData } from '../hooks/normalize'
import { videoRevalidation } from '../hooks/revalidate'

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** Accepts a bare ID or any common YouTube URL form and returns the 11-character ID (or null). */
export function parseYouTubeId(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (YOUTUBE_ID.test(value)) return value
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\.|^m\./, '')
    let id: string | null = null
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = url.searchParams.get('v')
      if (!id) {
        const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)
        id = m?.[1] ?? null
      }
    }
    return id && YOUTUBE_ID.test(id) ? id : null
  } catch {
    return null
  }
}

const extractYouTubeId: FieldHook = ({ value }) => parseYouTubeId(value) ?? value

export const Videos: CollectionConfig = {
  slug: 'videos',
  labels: { singular: 'Video', plural: 'Videos' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'youtubeId', '_status', 'publishedAt'], group: 'Content' },
  defaultSort: '-publishedAt',
  access: {
    read: publishedOrStaff,
    readVersions: staffOnly,
    create: editorsOnly,
    update: editorsOnly,
    delete: editorsOnly,
  },
  versions: { maxPerDoc: 20, drafts: true },
  hooks: {
    beforeValidate: [normalizeCollectionData],
    afterChange: videoRevalidation.afterChange,
    afterDelete: videoRevalidation.afterDelete,
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    slugField({ from: 'title', description: 'URL: /video/{slug}.' }),
    {
      name: 'youtubeId',
      type: 'text',
      required: true,
      hooks: { beforeValidate: [extractYouTubeId] },
      validate: (value: unknown) =>
        (typeof value === 'string' && YOUTUBE_ID.test(value)) || 'Paste a YouTube link or the 11-character video ID.',
      admin: { description: 'Paste the YouTube URL or ID.' },
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional. Defaults to the YouTube thumbnail.' },
    },
    { name: 'category', type: 'relationship', relationTo: 'categories' },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      index: true,
      defaultValue: () => new Date().toISOString(),
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' } },
    },
    createdByField(),
  ],
}
