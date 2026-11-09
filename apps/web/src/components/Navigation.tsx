import Link from 'next/link'

import { Icon } from './Icon'
import styles from './ui.module.css'

export interface Crumb {
  label: string
  href?: string
}

/** Breadcrumbs; the last crumb is the current page. JSON-LD BreadcrumbList is left to the seo helpers. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="ब्रेडक्रंब" className={styles.crumbs}>
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <li key={i}>
              {c.href && !last ? (
                <Link href={c.href}>{c.label}</Link>
              ) : (
                <span className={last ? styles.crumbCurrent : undefined} aria-current={last ? 'page' : undefined}>
                  {c.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** "पेज X / Y" + previous/next. Page 1 is the base path; page n is `${basePath}/page/${n}`. */
export function Pagination({ basePath, page, totalPages }: { basePath: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const href = (n: number) => (n <= 1 ? basePath : `${basePath}/page/${n}`)
  return (
    <nav aria-label="पेज नेविगेशन" className={styles.pager}>
      <span className={styles.pagerStatus}>
        पेज {page} / {totalPages}
      </span>
      <div className={styles.pagerLinks}>
        {page > 1 && (
          <Link href={href(page - 1)} rel="prev" className={styles.btnSecondary}>
            <Icon name="chevronLeft" size={18} />
            पिछला पेज
          </Link>
        )}
        {page < totalPages && (
          <Link href={href(page + 1)} rel="next" className={styles.btnPrimary}>
            अगला पेज
            <Icon name="chevronRight" size={18} />
          </Link>
        )}
      </div>
    </nav>
  )
}
