import Image from 'next/image'
import Link from 'next/link'

import type { ArticleCard, Home, NavItem, SiteSettings } from '@/lib/data/types'

import { BreakingBadge } from '../Badges'
import { formatLongDate } from '../format'
import { Icon } from '../Icon'
import styles from './Header.module.css'
import { MobileMenu } from './MobileMenu'
import { NavLink } from './NavLink'

interface Props {
  settings: SiteSettings
  categories: NavItem[]
  ticker: Home['ticker']
  breaking: ArticleCard[]
}

export function Header({ settings, categories, ticker, breaking }: Props) {
  const today = formatLongDate(new Date())
  const menuLinks = settings.navigation.footer.flatMap((g) => g.items)
  return (
    <>
      <header className={styles.header}>
        <div className={`container ${styles.top}`}>
          <Link href="/" className={styles.brand} aria-label={`${settings.name} — होम`}>
            {/* 48 px mobile / 72 px desktop; logo-144 covers 72 px at 2x. */}
            <Image
              src="/brand/logo-144.webp"
              width={144}
              height={144}
              alt=""
              unoptimized
              priority
              className={styles.logo}
            />
            <span className={styles.brandText}>
              <span className={styles.name}>लोक Lens न्यूज़</span>
              <span className={styles.tagline}>{settings.tagline}</span>
              <span className={styles.date}>{today}</span>
            </span>
          </Link>
          <form action="/search" method="get" role="search" className={styles.searchForm}>
            <label htmlFor="site-search" className="visually-hidden">
              खबरें खोजें
            </label>
            <input id="site-search" name="q" type="search" placeholder="खबरें खोजें…" minLength={2} maxLength={100} />
            <button type="submit" aria-label="खोजें">
              <Icon name="search" size={20} />
            </button>
          </form>
          <div className={styles.mobileActions}>
            <Link href="/search" className={styles.iconBtn} aria-label="खोजें">
              <Icon name="search" />
            </Link>
            <MobileMenu categories={categories} links={menuLinks} />
          </div>
        </div>
        <nav aria-label="श्रेणियां" className={styles.catNav}>
          <ul className={`container ${styles.catList}`}>
            <li>
              <NavLink href="/" className={styles.catLink}>
                होम
              </NavLink>
            </li>
            {categories.map((c) => (
              <li key={c.url}>
                <NavLink href={c.url} className={styles.catLink}>
                  {c.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {ticker.length > 0 && (
        <div className={styles.ticker}>
          <div className={`container ${styles.tickerInner}`}>
            <span className={styles.tickerLabel}>ट्रेंडिंग</span>
            <ul className={styles.tickerList} aria-label="ट्रेंडिंग खबरें">
              {ticker.map((t) => (
                <li key={t.url}>
                  <Link href={t.url}>{t.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {breaking.length > 0 && (
        <div className={styles.breaking}>
          <div className={`container ${styles.tickerInner}`}>
            <BreakingBadge />
            <Link href={breaking[0].url} className={styles.breakingLink}>
              {breaking[0].title}
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
