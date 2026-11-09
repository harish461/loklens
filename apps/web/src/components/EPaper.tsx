import Link from 'next/link'

import type { EPaper, Paginated } from '@/lib/data/types'

import styles from './EPaper.module.css'
import { formatLongDate } from './format'
import { Icon } from './Icon'
import { Breadcrumbs, Pagination } from './Navigation'
import ui from './ui.module.css'

export const EPAPER_PAGE_SIZE = 12

/** Strict yyyy-mm-dd that is a real calendar date. */
export function isValidEPaperDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** "सोमवार, 9 नवंबर 2026" (edition dates are IST calendar days). */
export const formatEPaperDate = (date: string) => formatLongDate(new Date(`${date}T00:00:00+05:30`))

/** Native date input → GET /e-paper/go?date=… → redirect to the edition. Works without JS. */
export function EPaperDateJump({ min, max, value }: { min?: string; max?: string; value?: string }) {
  return (
    <form action="/e-paper/go" method="get" className={styles.jump}>
      <label htmlFor="epaper-date">तारीख चुनें</label>
      <div className={styles.jumpRow}>
        <input id="epaper-date" name="date" type="date" min={min} max={max} defaultValue={value} required />
        <button type="submit" className={ui.btnPrimary}>
          देखें
        </button>
      </div>
    </form>
  )
}

export function EPaperHeader({ crumbs, title, subtitle }: { crumbs: { label: string; href?: string }[]; title: string; subtitle?: string }) {
  return (
    <div className={ui.pageHead}>
      <div className="container">
        <Breadcrumbs items={crumbs} />
        <h1 className={ui.pageTitle}>{title}</h1>
        {subtitle && <p className={ui.pageDesc}>{subtitle}</p>}
      </div>
    </div>
  )
}

/** Date cards, newest first, with paging. `range` feeds the date picker. */
export function EPaperList({ result, range }: { result: Paginated<EPaper>; range: { min?: string; max?: string } }) {
  return (
    <>
      <EPaperHeader
        crumbs={[{ label: 'होम', href: '/' }, { label: 'ई-पेपर' }]}
        title={result.page > 1 ? `ई-पेपर — पेज ${result.page}` : 'ई-पेपर'}
        subtitle="लोक Lens न्यूज़ का डिजिटल संस्करण — हर दिन का अखबार PDF में"
      />
      <div className="container">
        {result.items.length === 0 ? (
          <p className={ui.empty}>ई-पेपर जल्द ही यहां उपलब्ध होगा।</p>
        ) : (
          <>
            <EPaperDateJump min={range.min} max={range.max} />
            <ul className={styles.grid}>
              {result.items.map((e, i) => (
                <li key={e.date}>
                  <Link href={`/e-paper/${e.date}`} className={styles.card}>
                    <span className={styles.cardIcon} aria-hidden="true">
                      <Icon name="paper" size={28} />
                    </span>
                    <span className={styles.cardText}>
                      <span className={styles.cardDate}>{formatEPaperDate(e.date)}</span>
                      <span className={styles.cardEdition}>{e.edition}</span>
                    </span>
                    {result.page === 1 && i === 0 && <span className={styles.latest}>नया</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination basePath="/e-paper" page={result.page} totalPages={result.totalPages} />
          </>
        )}
      </div>
    </>
  )
}
