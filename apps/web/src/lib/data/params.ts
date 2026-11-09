import { BadRequestError } from './errors'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 50
export const MAX_PAGE = 10_000

/** Latin slug as stored (lowercase, hyphen-separated). Anything else is treated as "not found" or a 400. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const EPAPER_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export function isSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 80 && SLUG.test(value)
}

export function isEPaperDate(value: unknown): value is string {
  if (typeof value !== 'string' || !EPAPER_DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Parses an integer query value within [min, max]; undefined uses the default. */
export function parseInteger(
  value: unknown,
  name: string,
  { min, max, fallback }: { min: number; max: number; fallback: number },
): number {
  if (value === undefined || value === null) return fallback
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : NaN
  if (!Number.isSafeInteger(n) || n < min || n > max) {
    throw new BadRequestError(`${name} must be an integer from ${min} to ${max}.`)
  }
  return n
}

export function parsePage(value: unknown): number {
  return parseInteger(value, 'page', { min: 1, max: MAX_PAGE, fallback: 1 })
}

export function parsePageSize(value: unknown): number {
  return parseInteger(value, 'pageSize', { min: 1, max: MAX_PAGE_SIZE, fallback: DEFAULT_PAGE_SIZE })
}

/** Contract §2 search: 2–100 characters after NFC normalisation. */
export function parseSearchQuery(value: unknown): string {
  if (typeof value !== 'string') throw new BadRequestError('q is required.')
  const q = value.normalize('NFC').trim()
  if (q.length < 2 || q.length > 100) throw new BadRequestError('q must be 2 to 100 characters.')
  return q
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => '\\' + ch)
}
