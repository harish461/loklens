import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { ReactNode } from 'react'

import type { ArticleCard as Card, Paginated } from '@/lib/data/types'

import { AdSlot } from './AdSlot'
import { ArticleCard } from './ArticleCard'
import { BreakingBadge, CategoryLabel } from './Badges'
import { formatDateTime } from './format'
import styles from './ListingView.module.css'
import { Breadcrumbs, Pagination, type Crumb } from './Navigation'
import { NewsImage } from './NewsImage'

export const LISTING_PAGE_SIZE = 12

/**
 * `/x/page/{n}`: n must be an integer ≥ 2. "1" redirects to the base path; anything else is a 404.
 * Returns the page number.
 */
/** Helpers accept pages 1–10,000 (contract v1 draft 4); anything larger is simply not a listing page. */
export const MAX_LISTING_PAGE = 10_000

export function parsePageParam(raw: string, basePath: string): number {
  if (!/^\d+$/.test(raw)) notFound()
  const n = Number(raw)
  if (n === 1) permanentRedirect(basePath)
  if (n < 2 || n > MAX_LISTING_PAGE) notFound()
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
  sidebarTitle = 'ताज़ा और चर्चित खबरें',
  emptyText = 'अभी इस श्रेणी में कोई खबर प्रकाशित नहीं हुई है।',
  hideCategory,
}: Props) {
  const [lead, ...rest] = result.items
  const showLead = result.page === 1 && Boolean(lead)
  const gridItems = showLead ? rest : result.items

  return (
    <div className={styles.pageWrap}>
      {/* Modern Editorial Category Header Banner */}
      <div className="container">
        <header className={styles.heroBanner}>
          <div className={styles.bannerTop}>
            <Breadcrumbs items={crumbs} />
            {result.totalItems > 0 && (
              <span className={styles.storyCountBadge}>
                {result.totalItems} {result.totalItems === 1 ? 'खबर' : 'खबरें'}
              </span>
            )}
          </div>

          <div className={styles.bannerMain}>
            <div className={styles.titleGroup}>
              <span className={styles.kickerPill}>Special Coverage</span>
              <h1 className={styles.pageTitle}>
                {title}
                {result.page > 1 && <span className={styles.pageNo}> — पेज {result.page}</span>}
              </h1>
            </div>
            {description ? (
              <div className={styles.pageDesc}>{description}</div>
            ) : (
              <p className={styles.pageDesc}>
                {title} से जुड़ी ताज़ा खबरें, ग्राउंड रिपोर्ट, विश्लेषण और हर बड़ी अपडेट लोक Lens न्यूज़ पर।
              </p>
            )}
          </div>
        </header>
      </div>

      {/* Main Content + Sidebar Grid */}
      <div className={`container ${styles.layout}`}>
        <div className={styles.main}>
          {result.items.length === 0 ? (
            <div className={styles.emptyCard}>
              <div className={styles.emptyIcon} aria-hidden="true">
                📰
              </div>
              <h2 className={styles.emptyHeading}>{emptyText}</h2>
              <p className={styles.emptySub}>
                हमारी संपादकीय टीम जल्द ही इस सेक्शन में नई खबरें अपडेट करेगी। तब तक अन्य प्रमुख खबरें पढ़ें।
              </p>
              <Link href="/" className={styles.emptyBtn}>
                <span>होम पेज पर जाएं</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : (
            <>
              {/* Featured Lead Spotlight Card (Page 1) */}
              {showLead && lead && (
                <article className={styles.leadSpotlight}>
                  <Link href={lead.url} className={styles.leadMediaLink} tabIndex={-1} aria-hidden="true">
                    <div className={styles.leadMedia}>
                      <NewsImage
                        image={lead.image}
                        displayWidth={640}
                        sizes="(min-width: 1024px) 520px, (min-width: 768px) 50vw, 100vw"
                        priority
                      />
                      <span className={styles.leadBadge}>Top Story</span>
                    </div>
                  </Link>

                  <div className={styles.leadContent}>
                    <div className={styles.leadMetaTop}>
                      {lead.isBreaking && <BreakingBadge />}
                      {!hideCategory && <CategoryLabel category={lead.category} link={false} />}
                      {hideCategory && <span className={styles.categoryTag}>{title}</span>}
                      {lead.location?.name && <span className={styles.categoryTag}>{lead.location.name}</span>}
                    </div>

                    <h2 className={styles.leadTitle}>
                      <Link href={lead.url} className={styles.leadTitleLink}>
                        {lead.title}
                      </Link>
                    </h2>

                    {lead.summary && <p className={styles.leadSummary}>{lead.summary}</p>}

                    <div className={styles.leadFooter}>
                      <div className={styles.leadByline}>
                        <span className={styles.authorAvatar} aria-hidden="true">
                          LL
                        </span>
                        <div className={styles.bylineInfo}>
                          <span className={styles.authorName}>लोक Lens न्यूज़ ब्यूरो</span>
                          <time className={styles.publishTime} dateTime={lead.publishedAt}>
                            {formatDateTime(lead.publishedAt)}
                          </time>
                        </div>
                      </div>

                      <Link href={lead.url} className={styles.readMoreBtn}>
                        <span>पूरी खबर पढ़ें</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </div>
                </article>
              )}

              {/* Secondary Stories Magazine Grid */}
              {gridItems.length > 0 && (
                <section className={styles.storiesSection} aria-label={`${title} की अन्य खबरें`}>
                  {showLead && (
                    <div className={styles.subSectionHead}>
                      <span className={styles.subPulse} aria-hidden="true" />
                      <h2 className={styles.subSectionTitle}>अन्य प्रमुख खबरें</h2>
                    </div>
                  )}

                  <div className={styles.cardsGrid}>
                    {gridItems.map((a, i) => (
                      <div key={a.id} className={styles.gridItem}>
                        <ArticleCard
                          article={a}
                          variant="large"
                          headingLevel="h3"
                          showCategory={!hideCategory}
                          priority={!showLead && i < 2}
                        />
                        {i === 3 && <AdSlot size="mobile-banner" />}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <Pagination basePath={basePath} page={result.page} totalPages={result.totalPages} />
            </>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className={styles.sidebar} aria-labelledby="listing-side">
          {sidebar && sidebar.length > 0 && (
            <div className={styles.sidebarBlock}>
              <header className={styles.sideHeader}>
                <span className={styles.fireIcon} aria-hidden="true">
                  🔥
                </span>
                <h2 id="listing-side" className={styles.sideTitle}>
                  {sidebarTitle}
                </h2>
              </header>

              <ol className={styles.sideList}>
                {sidebar.map((a, i) => (
                  <li key={a.id} className={styles.sideItem}>
                    <ArticleCard article={a} variant="ranked" index={i + 1} headingLevel="h3" />
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* E-Paper Promo Card */}
          <div className={styles.epaperPromo}>
            <span className={styles.epaperBadge}>Daily E-Paper</span>
            <h3 className={styles.epaperTitle}>लोक Lens डिजिटल संस्करण</h3>
            <p className={styles.epaperDesc}>
              आज का पूरा समाचार पत्र डिजिटल फॉर्मेट में अपने मोबाइल व कंप्यूटर पर पढ़ें।
            </p>
            <Link href="/e-paper" className={styles.epaperBtn}>
              <span>ई-पेपर पढ़ें</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <AdSlot size="sidebar" />
        </aside>
      </div>
    </div>
  )
}
