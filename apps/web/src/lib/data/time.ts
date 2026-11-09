/** IST is a fixed +05:30 offset (no DST), so arithmetic on UTC is exact. */
const IST_OFFSET_MINUTES = 330

/**
 * Contract §principles: dates are stored UTC and serialised as ISO 8601 with the IST offset,
 * without milliseconds, e.g. 2026-11-09T15:30:00+05:30.
 */
export function toIST(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid date: ${String(value)}`)
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000)
  return `${shifted.toISOString().slice(0, 19)}+05:30`
}

/** Parses a value to epoch milliseconds, or null when it is empty or invalid. */
export function toEpoch(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const t = new Date(value as string | number | Date).getTime()
  return Number.isNaN(t) ? null : t
}
