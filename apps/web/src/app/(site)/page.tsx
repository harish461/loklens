import type { Metadata } from 'next'
import Link from 'next/link'

import { AdSlot } from '@/components/AdSlot'
import { ArticleCard } from '@/components/ArticleCard'
import { WhatsAppChannelBanner } from '@/components/ArticleExtras'
import { HeroCarousel } from '@/components/HeroCarousel'
import { SectionBlock } from '@/components/SectionBlock'
import { VideoCard } from '@/components/VideoCard'
import { YouTubeSection } from '@/components/YouTubeSection'
import { YouTubeStrip } from '@/components/YouTubeStrip'
import { YouTubeVideos } from '@/components/YouTubeVideos'
import type { ArticleCard as Card } from '@/lib/data/types'
import { getHome, getSiteSettings } from '@/lib/data'
import { getYouTubeLatest, getYouTubeVideos, YOUTUBE_CHANNEL_URL } from '@/lib/social'

import styles from './home.module.css'

export const revalidate = 300 // safety net; publishing revalidates the `home` tag on demand (architecture §4)

// TODO(seo): use the src/lib/seo home metadata + Organization/WebSite JSON-LD.
export const metadata: Metadata = {
  title: { absolute: 'लोक Lens न्यूज़ — आपकी आवाज़, आपकी खबर' },
}

/** Section heading row used by the body blocks. */
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

/** Unique by id, keeping the first occurrence. */
function uniqueById(list: Card[]): Card[] {
  const seen = new Set<number>()
  return list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
}

export default async function HomePage() {
  // getYouTubeLatest / getYouTubeVideos share one memoised feed read per render.
  const [home, settings, youtube, youtubeVideos] = await Promise.all([
    getHome(),
    getSiteSettings(),
    getYouTubeLatest(3),
    getYouTubeVideos(3),
  ])

  const youtubeUrl = settings.social.find((s) => s.platform === 'youtube')?.url ?? YOUTUBE_CHANNEL_URL
  const hasStrip = youtube.posts.length > 0 // feed failed → no block at all
  const hasVideos = youtubeVideos.posts.length > 0 // no non-Shorts uploads → no block at all

  // Hero: 3 latest in the carousel, 2 more as small cards beside it, then a row of 4 under it.
  const heroSlides = home.latest.slice(0, 3)
  const heroSide = home.latest.slice(3, 5)
  const smallRow = home.latest.slice(5, 9)

  // Recent News: the latest stories (may repeat stories shown above when the site has few articles).
  const recent = home.latest.slice(0, 6)

  // Breaking News: flagged breaking; if none, trending; if none, the block is hidden.
  const breakingSource = home.breaking.length ? home.breaking : home.latest.filter((a) => a.isTrending)
  const breaking = breakingSource.slice(0, 5)

  // Popular News: featured first, then latest. We do not track views yet, so this is editorial, not ranked by reads.
  const popular = uniqueById([...home.featured, ...home.latest]).slice(0, 5)

  return (
    <div className="container">
      <h1 className="visually-hidden">लोक Lens न्यूज़ — ताज़ा खबरें</h1>

      {/* 1–2. Hero: carousel as the large card; two small cards beside it on desktop, below it on phones. */}
      {heroSlides.length > 0 && (
        <div className={styles.hero}>
          <div className={styles.heroMain}>
            <HeroCarousel articles={heroSlides} />
          </div>
          {(heroSide.length > 0 || hasStrip) && (
            <div className={styles.heroSide}>
              {heroSide.map((a) => (
                <ArticleCard key={a.id} article={a} variant="list" />
              ))}
              {/* Desktop only: the Shorts strip fills the column under the cards so the hero row ends evenly. */}
              {hasStrip && (
                <div className={styles.heroStrip}>
                  <YouTubeStrip posts={youtube.posts} channelUrl={youtubeUrl} idSuffix="-hero" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Row of small image cards under the hero. */}
      {smallRow.length > 0 && (
        <div className={styles.smallRow}>
          {smallRow.map((a) => (
            <ArticleCard key={a.id} article={a} variant="large" headingLevel="h3" />
          ))}
        </div>
      )}

      <AdSlot size="mobile-banner" />

      {/* 4. Two-column body: wide left (Recent, Breaking) and narrow right (Popular). Stacks on phones in this order. */}
      <div className={styles.body}>
        <div className={styles.bodyMain}>
          {recent.length > 0 && (
            <section className={styles.block} aria-labelledby="recent-title">
              <BlockHead id="recent-title" title="ताज़ा खबरें" />
              <div className={styles.list}>
                {recent.map((a) => (
                  <ArticleCard key={a.id} article={a} variant="list" headingLevel="h3" />
                ))}
              </div>
            </section>
          )}

          {breaking.length > 0 && (
            <section className={styles.block} aria-labelledby="breaking-title">
              <BlockHead id="breaking-title" title="ब्रेकिंग न्यूज़" />
              <div className={styles.breakingGrid}>
                <ArticleCard article={breaking[0]} variant="large" headingLevel="h3" />
                {breaking.length > 1 && (
                  <div className={styles.list}>
                    {breaking.slice(1, 5).map((a) => (
                      <ArticleCard key={a.id} article={a} variant="list" headingLevel="h3" />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {popular.length > 0 && (
          <aside className={styles.bodyAside} aria-labelledby="popular-title">
            <BlockHead id="popular-title" title="लोकप्रिय खबरें" />
            <ol className={styles.ranked}>
              {popular.map((a, i) => (
                <li key={a.id}>
                  <ArticleCard article={a} variant="ranked" index={i + 1} headingLevel="h3" />
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>

      {/* 5. Live news / video row, fed by the YouTube data. Each block hides itself when empty. */}
      {(hasStrip || hasVideos || home.videos.length > 0) && (
        <div className={`${styles.live} ${hasVideos || home.videos.length > 0 ? '' : styles.liveStripOnly}`}>
          {hasStrip && (
            <div className={styles.liveStrip}>
              {/* Phones only; on desktop the same strip sits in the hero column. */}
              <YouTubeStrip posts={youtube.posts} channelUrl={youtubeUrl} idSuffix="-live" />
            </div>
          )}
          {hasVideos && <YouTubeVideos posts={youtubeVideos.posts} channelUrl={youtubeUrl} />}
          {home.videos.length > 0 && (
            <section className={styles.videoBand} aria-labelledby="videos-title">
              <div className={styles.videoHead}>
                <h2 id="videos-title" className={styles.videoTitle}>
                  वीडियो
                </h2>
                <Link href="/video" className={styles.videoMore}>
                  और देखें<span className="visually-hidden">: वीडियो</span>
                </Link>
              </div>
              <div className={styles.videoGrid}>
                {home.videos.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 6. Category sections, then the lower YouTube section and the WhatsApp banner before the footer. */}
      <div className={styles.sections}>
        {home.sections.map((s) => (
          <SectionBlock
            key={s.category.id}
            id={`section-${s.category.slug}`}
            title={s.category.name}
            href={`/${s.category.slug}`}
            articles={s.articles}
          />
        ))}
      </div>

      <YouTubeSection channelUrl={youtubeUrl} />

      <div className={styles.wa}>
        <WhatsAppChannelBanner settings={settings} />
      </div>
    </div>
  )
}
