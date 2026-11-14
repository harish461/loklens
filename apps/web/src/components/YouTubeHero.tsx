import type { SocialPost } from '@/lib/social'

import { formatRelative } from './format'
import { YouTubeIcon } from './Icon'
import styles from './YouTubeHero.module.css'
import { YouTubeThumb } from './YouTubeThumb'

const YOUTUBE_RED = '#FF0000'

/**
 * Home hero right column: the last three regular YouTube uploads, stacked. Shorts have their own row
 * (YouTubeShorts). Takes posts from the page's shared feed read. Renders nothing when there are no videos.
 */
export function YouTubeHero({ videos, channelUrl }: { videos: SocialPost[]; channelUrl: string }) {
  if (videos.length === 0) return null
  return (
    <section className={styles.hero} aria-labelledby="yt-hero-title">
      <div className={styles.head}>
        <h2 id="yt-hero-title" className={styles.title}>
          <YouTubeIcon size={22} color={YOUTUBE_RED} />
          YouTube Videos
        </h2>
        <a href={channelUrl} target="_blank" rel="noopener" className={styles.subscribe}>
          Subscribe
          <span className="visually-hidden"> (YouTube, नए टैब में खुलेगा)</span>
        </a>
      </div>

      <ul className={styles.videoList}>
        {videos.map((post) => (
          <li key={post.id}>
            <a href={post.url} target="_blank" rel="noopener" className={`${styles.card} card`}>
              <YouTubeThumb post={post} />
              <span className={styles.body}>
                <span className={styles.cardTitle}>{post.title || 'YouTube वीडियो'}</span>
                <time className={styles.time} dateTime={post.publishedAt}>
                  {formatRelative(post.publishedAt)}
                </time>
              </span>
              <span className="visually-hidden"> (YouTube पर देखें)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
