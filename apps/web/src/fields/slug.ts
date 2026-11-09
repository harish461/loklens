import type { CollectionSlug, FieldHook, TextField, Validate, Where } from 'payload'

import { slugifyTitle, toSlug, transliterateHindi, withSuffix } from '../lib/slug/transliterate'
import { validateSlugFormat, type ValidationResult } from '../lib/slug/validate'

interface SlugFieldOptions {
  /** Field the slug is generated from. */
  from?: string
  /** Extra validation (e.g. reserved names for categories). */
  validate?: (value: unknown) => ValidationResult
  description?: string
}

const MAX_SUFFIX_ATTEMPTS = 50

/**
 * Builds the slug before validation:
 * - empty → generated from the source field (Hindi transliterated to Latin)
 * - typed by an editor → normalised (lowercase, hyphens; Hindi typed here is transliterated too)
 * - collides with another document → "-2", "-3", … appended so saves never fail on the unique index
 */
const buildSlug =
  (from: string): FieldHook =>
  async ({ value, data, originalDoc, req, collection }) => {
    const typed = typeof value === 'string' ? value.trim() : ''
    const source = (data?.[from] ?? originalDoc?.[from]) as string | undefined
    let slug = typed ? toSlug(transliterateHindi(typed)) : slugifyTitle(source ?? '')
    if (!slug) return value

    if (!collection || !req?.payload) return slug
    const ownId = (originalDoc as { id?: number | string } | undefined)?.id
    for (let n = 2; n <= MAX_SUFFIX_ATTEMPTS + 1; n++) {
      const where: Where = { slug: { equals: slug } }
      if (ownId !== undefined) where.id = { not_equals: ownId }
      const existing = await req.payload.count({
        collection: collection.slug as CollectionSlug,
        where,
        overrideAccess: true,
        req,
      })
      if (existing.totalDocs === 0) return slug
      slug = withSuffix(typed ? toSlug(transliterateHindi(typed)) : slugifyTitle(source ?? ''), n)
    }
    return slug
  }

export function slugField({ from = 'title', validate, description }: SlugFieldOptions = {}): TextField {
  const validator: Validate<string> = (value) => {
    const format = validateSlugFormat(value)
    if (format !== true) return format
    return validate ? validate(value) : true
  }
  return {
    name: 'slug',
    type: 'text',
    required: true,
    unique: true,
    index: true,
    maxLength: 80,
    validate: validator,
    hooks: { beforeValidate: [buildSlug(from)] },
    admin: {
      position: 'sidebar',
      description:
        description ??
        'Latin URL slug. Leave empty to generate it from the Hindi title; edit freely (lowercase, hyphens).',
    },
  }
}
