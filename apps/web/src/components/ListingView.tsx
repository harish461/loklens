import { notFound, permanentRedirect } from 'next/navigation'
import type { ReactNode } from 'react'

import type { ArticleCard as Card, Paginated } from '@/lib/data/types'

import { AdSlot } from './AdSlot'
import { ArticleCard } from './ArticleCard'
import styles from './ListingView.module.css'
import { Breadcrumbs, Pagination, type Crumb } from './Navigation'
import ui from './ui.module.css'

export const LISTING_PAGE_SIZE = 12

/**
 * `/x/page/{n}`: n must be an integer ≥ 2. "1" redirects to the base path; anything else is a 404.
 * Returns the page number.
 */
export function parsePageParam(raw: string, basePath: string): number {
  if (!/^\d+$/.test(raw)) notFound()
  const n = Number(raw)
  if (n === 1) permanentRedirect(basePath)
  if (n < 2 || !Number.isSafeInteger(n)) notFound()
  return n
}

interface Props {
  title: string
  description?: ReactNode
  crumbs: Crumb[]
  result: Paginated<Card>
  basePath: string
  sidebar?: Card[]
  sidebarTitle?: string
  emptyText?: string
  /** Hide each card's category label (category pages). */
  hideCategory?: boolean
}

export function ListingView({
  title,
  description,
  crumbs,
  result,
  basePath,
  sidebar,
  sidebarTitle = 'ताज़ा खबरें',
  emptyText = 'अभी यहां कोई खबर नहीं है।',
  hideCategory,
}: Props) {
  const [lead, ...rest] = result.items
  const showLead = result.page === 1 && lead
  return (
    <>
      <div className={ui.pageHead}>
        <div className="container">
          <Breadcrumbs items={crumbs} />
          <h1 className={ui.pageTitle}>
            {title}
            {result.page > 1 && <span className={styles.pageNo}> — पेज {result.page}</span>}
          </h1>
          {description && <div className={ui.pageDesc}>{description}</div>}
        </div>
      </div>
      <div className={`container ${styles.layout}`}>
        <div className={styles.main}>
          {result.items.length === 0 && <p className={ui.empty}>{emptyText}</p>}
          {showLead && (
            <div className={styles.lead}>
              <ArticleCard article={lead} variant="hero" priority headingLevel="h2" showCategory={!hideCategory} />
            </div>
          )}
          <div className={styles.list}>
            {(showLead ? rest : result.items).map((a, i) => (
              <div key={a.id}>
                <ArticleCard
                  article={a}
                  variant="list"
                  thumb="left"
                  headingLevel="h2"
                  showCategory={!hideCategory}
                  priority={!showLead && i < 2}
                />
                {i === 4 && <AdSlot size="mobile-banner" />}
              </div>
            ))}
          </div>
          <Pagination basePath={basePath} page={result.page} totalPages={result.totalPages} />
        </div>
        {sidebar && sidebar.length > 0 && (
          <aside className={styles.sidebar} aria-labelledby="listing-side">
            <h2 id="listing-side" className={styles.sideTitle}>
              {sidebarTitle}
            </h2>
            <ol className={styles.sideList}>
              {sidebar.map((a, i) => (
                <li key={a.id}>
                  <ArticleCard article={a} variant="numbered" index={i + 1} />
                </li>
              ))}
            </ol>
            <AdSlot size="sidebar" />
          </aside>
        )}
      </div>
    </>
  )
}
