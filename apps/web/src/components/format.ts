// Date formatting in IST for Hindi UI. Absolute times only: pages are cached (ISR), so relative
// times ("2 घंटे पहले") would go stale.
const TZ = 'Asia/Kolkata'

const dateTimeFmt = new Intl.DateTimeFormat('hi-IN', {
  timeZone: TZ,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const dateFmt = new Intl.DateTimeFormat('hi-IN', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' })
const longDateFmt = new Intl.DateTimeFormat('hi-IN', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso))
export const formatDate = (iso: string) => dateFmt.format(new Date(iso))
export const formatLongDate = (date: Date) => longDateFmt.format(date)

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://loklensnews.com').replace(/\/$/, '')
export const absoluteUrl = (path: string) => (path.startsWith('http') ? path : `${SITE_URL}${path}`)

const relFmt = new Intl.RelativeTimeFormat('hi', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/**
 * "3 घंटे पहले". Only for external social posts: the page is cached for minutes, so the value can lag
 * by up to the cache time, which is fine at hour/day granularity. Under a minute → "अभी".
 */
export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  if (Number.isNaN(seconds)) return ''
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relFmt.format(Math.round(seconds / size), unit)
  }
  return 'अभी'
}
