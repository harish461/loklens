import path from 'path'

import { APIError, type CollectionBeforeValidateHook, type CollectionConfig, type ImageSize } from 'payload'

import { anyone, editorsOnly, mediaUpdate, staffOnly } from '../access'
import { createdByField } from '../fields/common'
import { normalizeCollectionData } from '../hooks/normalize'

/**
 * Originals live in <app cwd>/media (apps/web/media locally), outside /public and the build output;
 * Docker mounts the media volume there. Payload resolves staticDir against process.cwd().
 */
export const MEDIA_ROOT = path.resolve(process.cwd(), 'media')
export const MEDIA_DIR = path.join(MEDIA_ROOT, 'images')

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB per image
export const MAX_ORIGINAL_PX = 2560

const webp = { format: 'webp' as const, options: { quality: 80 } }

/** Architecture §5. Names are part of the API contract (ImageSize). */
export const IMAGE_SIZES: ImageSize[] = [
  { name: 'thumb', width: 320, formatOptions: webp, withoutEnlargement: true },
  { name: 'card', width: 640, formatOptions: webp, withoutEnlargement: true },
  { name: 'article', width: 1200, formatOptions: webp, withoutEnlargement: true },
  { name: 'og', width: 1200, height: 630, position: 'centre', formatOptions: webp },
  { name: 'wide', width: 1200, height: 675, position: 'centre', formatOptions: webp },
  { name: 'standard', width: 1200, height: 900, position: 'centre', formatOptions: webp },
  { name: 'square', width: 1200, height: 1200, position: 'centre', formatOptions: webp },
]

const limitImageSize: CollectionBeforeValidateHook = ({ req }) => {
  const size = req.file?.size
  if (typeof size === 'number' && size > MAX_IMAGE_BYTES) {
    throw new APIError(`Image is too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB).`, 413, undefined, true)
  }
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Media', plural: 'Media' },
  admin: { group: 'Content', defaultColumns: ['filename', 'alt', 'credit', 'updatedAt'] },
  access: {
    read: anyone,
    create: staffOnly,
    update: mediaUpdate,
    delete: editorsOnly,
  },
  hooks: {
    beforeValidate: [limitImageSize, normalizeCollectionData],
  },
  upload: {
    staticDir: MEDIA_DIR,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    // Cap originals; store as WebP too so the "original" URL is never a multi-MB JPEG.
    resizeOptions: { width: MAX_ORIGINAL_PX, height: MAX_ORIGINAL_PX, fit: 'inside', withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 85 } },
    imageSizes: IMAGE_SIZES,
    adminThumbnail: 'thumb',
    focalPoint: true,
    crop: true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      maxLength: 250,
      admin: { description: 'Hindi description of the image for screen readers and Google (required).' },
    },
    { name: 'caption', type: 'text', maxLength: 300 },
    { name: 'credit', type: 'text', maxLength: 120, admin: { description: 'Photographer / agency.' } },
    createdByField(),
  ],
}
