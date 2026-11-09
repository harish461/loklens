import type { Metadata } from 'next'
import Link from 'next/link'

import { AdSlot } from '@/components/AdSlot'
import { ArticleCard } from '@/components/ArticleCard'
import { WhatsAppChannelBanner } from '@/components/ArticleExtras'
import { SectionBlock } from '@/components/SectionBlock'
import { VideoCard } from '@/components/VideoCard'
import { YouTubeSection } from '@/components/YouTubeSection'
import { HeroCarousel } from '@/components/HeroCarousel'
import { YouTubeStrip } from '@/components/YouTubeStrip'
import { YouTubeVideos } from '@/components/YouTubeVideos'
import { getHome, getSiteSettings } from '@/lib/data'
import { getYouTubeLatest, getYouTubeVideos, YOUTUBE_CHANNEL_URL } from '@/lib/social'

import styles from './home.module.css'

export const revalidate = 300 // safety net; publishing revalidates the `home` tag on demand (architecture §4)

// TODO(seo): use the src/lib/seo home metadata + Organization/WebSite JSON-LD.
export const metadata: Metadata = {
  title: { absolute: 'लोक Lens न्यूज़ — आपकी आवाज़, आपकी खबर' },
}

export default async function HomePage() {
  // getYouTubeLatest is memoised per render, so the lower YouTubeSection reuses this same fetch.
  const [home, settings, youtube, youtubeVideos] = await Promise.all([
    getHome(),
    getSiteSettings(),
    getYouTubeLatest(3),
    getYouTubeVideos(3),
  ])
  // Hero carousel: the 3 latest published stories. Featured below skips any story already in the hero.
  const heroSlides = home.latest.slice(0, 3)
  const featured = home.featured.filter((a) => !heroSlides.some((s) => s.id === a.id))
  const latest = home.latest.slice(0, 6)
  const youtubeUrl = settings.social.find((s) => s.platform === 'youtube')?.url ?? YOUTUBE_CHANNEL_URL
  const hasStrip = youtube.posts.length > 0 // feed failed → no strip, no empty space
  const hasVideos = youtubeVideos.posts.length > 0 // no non-Shorts uploads → no video section at all

  return (
    <div className="container">
      <h1 className="visually-hidden">लोक Lens न्यूज़ — ताज़ा खबरें</h1>

      {/*
        Hero grid. Mobile order: lead → YouTube strip → secondary → latest.
        Desktop (≥1024): lead | strip on top of the right column, then secondary | latest.
      */}
      <div className={`${styles.top} ${hasVideos ? styles.withVideos : hasStrip ? styles.withStrip : ''}`}>
        {heroSlides.length > 0 && (
          <div className={styles.lead}>
            <HeroCarousel articles={heroSlides} />
          </div>
        )}

        {hasStrip && (
          <div className={styles.strip}>
            <YouTubeStrip posts={youtube.posts} channelUrl={youtubeUrl} />
          </div>
        )}

        {hasVideos && (
          <div className={styles.videos}>
            <YouTubeVideos posts={youtubeVideos.posts} channelUrl={youtubeUrl} />
          </div>
        )}

        <section className={styles.featured} aria-label="मुख्य खबरें">
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

      <YouTubeSection channelUrl={youtubeUrl} />

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
