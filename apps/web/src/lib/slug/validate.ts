import { isReservedSlug } from './reserved'
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from './transliterate'

/** Payload-style result: `true` when valid, otherwise an error message for the admin UI. */
export type ValidationResult = true | string

export function validateSlugFormat(value: unknown, maxLength = SLUG_MAX_LENGTH): ValidationResult {
  if (value === undefined || value === null || value === '') return 'Slug is required.'
  if (typeof value !== 'string') return 'Slug must be text.'
  if (value.length > maxLength) return `Slug must be at most ${maxLength} characters.`
  if (!SLUG_PATTERN.test(value)) {
    return 'Slug may contain only lowercase Latin letters, digits and single hyphens (e.g. "pradesh-news").'
  }
  return true
}

/** Category slugs sit at the URL root, so they must also avoid reserved route names (architecture §3). */
export function validateCategorySlug(value: unknown): ValidationResult {
  const format = validateSlugFormat(value)
  if (format !== true) return format
  if (isReservedSlug(value as string)) {
    return `"${value as string}" is a reserved route name and cannot be used as a category slug.`
  }
  return true
}
