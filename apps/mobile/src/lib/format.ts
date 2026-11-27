/** Hindi date/time helpers (Latin digits, as on loklensnews.com). No Intl dependency (Hermes-safe). */

const MONTHS = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर']
const WEEKDAYS = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार']
const IST_OFFSET_MIN = 330

/** Wall-clock parts in India Standard Time, whatever the device timezone. */
function ist(date: Date) {
  const d = new Date(date.getTime() + IST_OFFSET_MIN * 60_000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), min: d.getUTCMinutes() }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "23 नवंबर 2026" */
export function formatDate(iso: string | Date): string {
  const p = ist(new Date(iso))
  return `${p.day} ${MONTHS[p.m]} ${p.y}`
}

/** "23 नवंबर 2026, 14:05" */
export function formatDateTime(iso: string | Date): string {
  const p = ist(new Date(iso))
  return `${formatDate(iso)}, ${pad(p.h)}:${pad(p.min)}`
}

/** "सोमवार, 23 नवंबर 2026" (header date line) */
export function formatToday(now: Date = new Date()): string {
  return `${WEEKDAYS[ist(now).wd]}, ${formatDate(now)}`
}

/** "अभी", "5 मिनट पहले", "3 घंटे पहले", "कल", else the date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diffMin = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (Number.isNaN(diffMin)) return ''
  if (diffMin < 1) return 'अभी'
  if (diffMin < 60) return `${diffMin} मिनट पहले`
  const hours = Math.floor(diffMin / 60)
  if (hours < 24) return `${hours} घंटे पहले`
  if (hours < 48) return 'कल'
  return formatDate(iso)
}
