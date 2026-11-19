import path from 'path'

import { APIError, type CollectionBeforeOperationHook, type CollectionBeforeValidateHook, type CollectionConfig, type ImageSize } from 'payload'

import { anyone, editorsOnly, mediaUpdate, staffOnly } from '../access'
import { createdByField } from '../fields/common'
import { normalizeCollectionData } from '../hooks/normalize'
import { slugifyTitle } from '../lib/slug/transliterate'

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

/**
 * Converts raw camera / WhatsApp filenames ("WhatsApp Image 2026-11-14 at 10.30.12 PM (1).jpeg")
 * into clean, hyphenated SEO slugs derived from alt text or sanitized filename base.
 */
export function toSeoImageFilename(rawName: string, altHint?: string): string {
  const extMatch = rawName.match(/\.([a-zA-Z0-9]+)$/)
  const ext = (extMatch ? extMatch[1].toLowerCase() : 'webp').replace(/^jpeg$/, 'jpg')
  const baseWithoutExt = rawName.replace(/\.[^.]+$/, '')
  const isGenericName =
    /^(?:whatsapp[\s_-]*image|img|dsc|pxl|screenshot|image|photo|pic|untitled)[\s_0-9().:-]*$/i.test(
      baseWithoutExt.trim(),
    )

  const candidateFromAlt = altHint ? slugifyTitle(altHint).slice(0, 56).replace(/-+$/, '') : ''
  const candidateFromBase = isGenericName
    ? ''
    : slugifyTitle(baseWithoutExt.replace(/\(\d+\)/g, ' '))
        .slice(0, 56)
        .replace(/-+$/, '')

  const slugBase = candidateFromAlt || candidateFromBase || 'loklens-news'
  const uniqueSuffix = Date.now().toString(36).slice(-5)
  return `${slugBase}-${uniqueSuffix}.${ext}`
}

const sanitizeUploadFilename: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if ((operation === 'create' || operation === 'update') && req.file?.name) {
    const data = (args as { data?: { alt?: string } })?.data
    req.file.name = toSeoImageFilename(req.file.name, data?.alt)
  }
  return args
}

const limitImageSize: CollectionBeforeValidateHook = ({ req, data }) => {
  const size = req.file?.size
  if (typeof size === 'number' && size > MAX_IMAGE_BYTES) {
    throw new APIError(`Image is too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB).`, 413, undefined, true)
  }
  if (req.file?.name && /^(?:whatsapp|img_|dsc|screenshot)/i.test(req.file.name)) {
    req.file.name = toSeoImageFilename(req.file.name, typeof data?.alt === 'string' ? data.alt : undefined)
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
    beforeOperation: [sanitizeUploadFilename],
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
