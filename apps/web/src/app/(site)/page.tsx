import type { Metadata } from 'next'
import Link from 'next/link'

import { ArticleCard } from '@/components/ArticleCard'
import { CategoryTabs } from '@/components/CategoryTabs'
import { HeroCarousel } from '@/components/HeroCarousel'
import { YouTubeHero } from '@/components/YouTubeHero'
import { YouTubeShorts } from '@/components/YouTubeShorts'
import { getHome, getSiteSettings } from '@/lib/data'
import { getYouTubeShorts, getYouTubeVideos, YOUTUBE_CHANNEL_URL } from '@/lib/social'

import styles from './home.module.css'

export const revalidate = 300 // safety net; publishing revalidates the `home` tag on demand (architecture §4)

// TODO(seo): use the src/lib/seo home metadata + Organization/WebSite JSON-LD.
export const metadata: Metadata = {
  title: { absolute: 'लोक Lens न्यूज़ — आपकी आवाज़, आपकी खबर' },
}

/** Section heading row: bold title over a thin rule, optional "more" link. */
function BlockHead({ id, title, href }: { id: string; title: string; href?: string }) {
  return (
    <header className={styles.blockHead}>
      <h2 id={id} className={styles.blockTitle}>
        {title}
      </h2>
      {href && (
        <Link href={href} className={styles.blockMore}>
          और देखें<span className="visually-hidden">: {title}</span>
        </Link>
      )}
    </header>
  )
}

export default async function HomePage() {
  // The YouTube helpers share one memoised feed read per render.
  const [home, settings, youtubeVideos, youtubeShorts] = await Promise.all([
    getHome(),
    getSiteSettings(),
    getYouTubeVideos(3),
    getYouTubeShorts(3),
  ])

  const youtubeUrl = settings.social.find((s) => s.platform === 'youtube')?.url ?? YOUTUBE_CHANNEL_URL

  // Editors' Picks carousel: the three latest stories.
  const picks = home.latest.slice(0, 3)

  // ताज़ा खबरें: the newest stories, in publish order.
  const latest = home.latest.slice(0, 6)

  // Category tabs: only categories that have stories, each with its newest three shown as cards.
  const categoryTabs = home.sections.filter((s) => s.articles.length > 0)

  return (
    <div className="container">
      <h1 className="visually-hidden">लोक Lens न्यूज़ — ताज़ा खबरें</h1>

      {/* Row 1: Editors' Picks (left) and the YouTube videos and Shorts (right). */}
      {picks.length > 0 && (
        <div className={styles.topRow}>
          <section className={styles.picks} aria-labelledby="picks-title">
            <BlockHead id="picks-title" title="संपादक की पसंद" />
            <HeroCarousel articles={picks} />
          </section>

          <aside className={styles.sideCol} aria-label="YouTube">
            <YouTubeHero videos={youtubeVideos.posts} channelUrl={youtubeUrl} />
            <div className={styles.shorts}>
              <YouTubeShorts shorts={youtubeShorts.posts} channelUrl={youtubeUrl} variant="compact" />
            </div>
          </aside>
        </div>
      )}

      {/* Section 2: category tabs, full width. Section 3: ताज़ा खबरें beneath them, full width. */}
      {(categoryTabs.length > 0 || latest.length > 0) && (
        <div className={styles.midRow}>
          <CategoryTabs tabs={categoryTabs} title="श्रेणियां" />

          {latest.length > 0 && (
            <section className={styles.sideNews} aria-labelledby="recent-title">
              <BlockHead id="recent-title" title="ताज़ा खबरें" />
              <div className={styles.list}>
                {latest.map((a) => (
                  <ArticleCard key={a.id} article={a} variant="list" headingLevel="h3" />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
