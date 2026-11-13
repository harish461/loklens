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

export const dynamic = 'force-dynamic'
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
  const whatsappUrl = settings.social.find((s) => s.platform === 'whatsapp')?.url ?? 'https://whatsapp.com'

  // Editors' Picks carousel: the three latest stories.
  const picks = home.latest.slice(0, 3)

  // ताज़ा खबरें: the newest stories, after picks (fallback to all latest if < 4)
  const latestStories = home.latest.length > 3 ? home.latest.slice(3, 9) : home.latest.slice(0, 6)

  // ट्रेंडिंग / सर्वाधिक पढ़ी गई खबरें
  const trendingStories = (home.featured.length > 0 ? home.featured : home.latest).slice(0, 5)

  // Category tabs: only categories that have stories, each with its newest three shown as cards.
  const categoryTabs = home.sections.filter((s) => s.articles.length > 0)

  return (
    <div className="container">
      <h1 className="visually-hidden">लोक Lens न्यूज़ — ताज़ा खबरें</h1>

      {/* Row 1: Editors' Picks (left) and the YouTube videos and Shorts (right). REMAINS SAME. */}
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

      {/* Row 2: Category Tabs Showcase */}
      {categoryTabs.length > 0 && (
        <section className={styles.categorySection} aria-label="श्रेणीवार विशेष कवरेज">
          <CategoryTabs tabs={categoryTabs} title="श्रेणीवार विशेष कवरेज" />
        </section>
      )}

      {/* Row 3: Modern Magazine Split (ताज़ा समाचार 2-Col Grid + ट्रेंडिंग 1-Col Ranked Sidebar) */}
      {(latestStories.length > 0 || trendingStories.length > 0) && (
        <div className={styles.magazineRow}>
          {latestStories.length > 0 && (
            <section className={styles.newsStreamCol} aria-labelledby="latest-stream-title">
              <header className={styles.streamHead}>
                <div className={styles.streamTitleWrap}>
                  <span className={styles.livePulse} aria-hidden="true" />
                  <h2 id="latest-stream-title" className={styles.streamTitle}>
                    ताज़ा समाचार
                  </h2>
                  <span className={styles.streamTag}>लाइव बुलेटिन</span>
                </div>
                <Link href={categoryTabs[0] ? `/${categoryTabs[0].category.slug}` : '/'} className={styles.streamMore}>
                  सभी ताज़ा खबरें →
                </Link>
              </header>

              <div className={styles.latestCardsGrid}>
                {latestStories.map((a) => (
                  <div key={a.id} className={styles.latestCardWrap}>
                    <ArticleCard article={a} variant="large" headingLevel="h3" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {trendingStories.length > 0 && (
            <aside className={styles.sidebarCol} aria-labelledby="trending-title">
              <div className={styles.trendingBox}>
                <header className={styles.trendingHeader}>
                  <span className={styles.fireIcon} aria-hidden="true">
                    🔥
                  </span>
                  <h2 id="trending-title" className={styles.trendingTitle}>
                    सर्वाधिक पढ़ी गई खबरें
                  </h2>
                </header>
                <ol className={styles.trendingList}>
                  {trendingStories.map((a, idx) => (
                    <li key={a.id} className={styles.trendingItem}>
                      <ArticleCard article={a} variant="ranked" index={idx + 1} headingLevel="h3" />
                    </li>
                  ))}
                </ol>
              </div>

              {/* Digital E-Paper Promotion Mini-Card */}
              <div className={styles.epaperCard}>
                <span className={styles.epaperBadge}>दैनिक ई-पेपर</span>
                <h3 className={styles.epaperHeading}>लोक Lens डिजिटल संस्करण</h3>
                <p className={styles.epaperText}>
                  आज का पूरा समाचार पत्र डिजिटल फॉर्मेट में अपने मोबाइल व कंप्यूटर पर पढ़ें।
                </p>
                <Link href="/e-paper" className={styles.epaperAction}>
                  <span>ई-पेपर पढ़ें</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Row 4: Branded Digital Hub & Contact Us Banner */}
      <section className={styles.digitalHub} aria-label="लोक Lens डिजिटल मंच">
        <div className={styles.hubContent}>
          <div className={styles.hubInfo}>
            <span className={styles.hubKicker}>आपकी आवाज़, आपकी खबर</span>
            <h2 className={styles.hubTitle}>निष्पक्ष, सटीक और भरोसेमंद पत्रकारिता</h2>
            <p className={styles.hubDesc}>
              उत्तराखंड के जमीनी सरोकारों से लेकर राष्ट्रीय परिदृश्य तक — लोक Lens न्यूज़ पर हर पल की सटीक और विश्वसनीय
              रिपोर्टिंग।
            </p>
          </div>
          <div className={styles.hubButtons}>
            <Link href="/about" className={styles.btnAbout}>
              हमारे बारे में
            </Link>
            <Link href="/contact" className={styles.btnContact}>
              संपर्क करें
            </Link>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.btnWhatsApp}>
              WhatsApp चैनल
            </a>
          </div>
        </div>
      </section>

      {/* Row 5: Explore All Categories Ribbon */}
      {home.sections.length > 0 && (
        <section className={styles.categoryRibbon} aria-labelledby="all-cats-title">
          <header className={styles.ribbonHeader}>
            <h2 id="all-cats-title" className={styles.ribbonTitle}>
              सभी प्रमुख श्रेणियां एक्सप्लोर करें
            </h2>
          </header>
          <div className={styles.ribbonList}>
            {home.sections.map((sec) => (
              <Link key={sec.category.id} href={`/${sec.category.slug}`} className={styles.ribbonPill}>
                <span className={styles.pillText}>{sec.category.name}</span>
                <span className={styles.pillArrow} aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
            <Link href="/about" className={styles.ribbonPill}>
              <span className={styles.pillText}>हमारे बारे में</span>
              <span className={styles.pillArrow} aria-hidden="true">
                →
              </span>
            </Link>
            <Link href="/contact" className={styles.ribbonPill}>
              <span className={styles.pillText}>संपर्क करें</span>
              <span className={styles.pillArrow} aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
