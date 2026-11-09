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
