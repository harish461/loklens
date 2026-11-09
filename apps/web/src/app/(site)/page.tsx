import type { Metadata } from 'next'
import Link from 'next/link'

import { AdSlot } from '@/components/AdSlot'
import { ArticleCard } from '@/components/ArticleCard'
import { WhatsAppChannelBanner } from '@/components/ArticleExtras'
import { SectionBlock } from '@/components/SectionBlock'
import { VideoCard } from '@/components/VideoCard'
import { YouTubeSection } from '@/components/YouTubeSection'
import { getHome, getSiteSettings } from '@/lib/mock'

import styles from './home.module.css'

export const revalidate = 300 // safety net; publishing revalidates the `home` tag on demand (architecture §4)

// TODO(seo): use the src/lib/seo home metadata + Organization/WebSite JSON-LD.
export const metadata: Metadata = {
  title: { absolute: 'लोक Lens न्यूज़ — आपकी आवाज़, आपकी खबर' },
}

export default async function HomePage() {
  const [home, settings] = await Promise.all([getHome(), getSiteSettings()])
  const [lead, ...featured] = home.featured.length ? home.featured : home.latest
  const latest = home.latest.slice(0, 6)

  return (
    <div className="container">
      <h1 className="visually-hidden">लोक Lens न्यूज़ — ताज़ा खबरें</h1>

      <div className={styles.top}>
        <section className={styles.featured} aria-label="मुख्य खबरें">
          {lead && <ArticleCard article={lead} variant="hero" priority headingLevel="h2" />}
          <div className={styles.secondary}>
            {featured.slice(0, 2).map((a) => (
              <ArticleCard key={a.id} article={a} variant="large" />
            ))}
          </div>
          <div className={styles.featuredMore}>
            {featured.slice(2).map((a) => (
              <ArticleCard key={a.id} article={a} variant="list" />
            ))}
          </div>
        </section>

        <aside className={styles.sidebar} aria-labelledby="latest-title">
          <h2 id="latest-title" className={styles.sideTitle}>
            ताज़ा खबरें
          </h2>
          <div className={styles.latestMobile}>
            {latest.map((a) => (
              <ArticleCard key={a.id} article={a} variant="list" />
            ))}
          </div>
          <ol className={styles.latestDesktop}>
            {latest.map((a, i) => (
              <li key={a.id}>
                <ArticleCard article={a} variant="numbered" index={i + 1} />
              </li>
            ))}
          </ol>
          <AdSlot size="sidebar" />
        </aside>
      </div>

      <AdSlot size="mobile-banner" />
      <hr className={styles.band} />

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

      <YouTubeSection channelUrl={settings.social.find((s) => s.platform === 'youtube')?.url} />

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

      <div className={styles.wa}>
        <WhatsAppChannelBanner settings={settings} />
      </div>
    </div>
  )
}
