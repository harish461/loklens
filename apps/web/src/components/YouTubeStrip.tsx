import type { SocialPost } from '@/lib/social'

import { YouTubeIcon } from './Icon'
import styles from './YouTubeStrip.module.css'
import { YouTubeThumb } from './YouTubeThumb'

/**
 * Compact hero-area strip of the latest uploads. Mobile: horizontal scroll-snap row (~2.3 cards
 * visible). Desktop: 3 cards across the top of the right column. The caller renders it only when
 * there are posts, so a failed feed leaves no empty space.
 */
export function YouTubeStrip({ posts, channelUrl }: { posts: SocialPost[]; channelUrl: string }) {
  if (posts.length === 0) return null
  return (
    <section className={styles.strip} aria-labelledby="yt-strip-title">
      <div className={styles.head}>
        <h2 id="yt-strip-title" className={styles.title}>
          <YouTubeIcon size={22} color="#FF0000" />
          YouTube पर ताज़ा
        </h2>
        <a href={channelUrl} target="_blank" rel="noopener" className={styles.subscribe}>
          सब्सक्राइब करें
          <span className="visually-hidden"> (YouTube, नए टैब में खुलेगा)</span>
        </a>
      </div>
      <ul className={styles.row}>
        {posts.map((post) => (
          <li key={post.id} className={styles.item}>
            <a href={post.url} target="_blank" rel="noopener" className={`${styles.card} card`}>
              {/* Shorts use a compact 4:5 box in the strip; regular videos keep 16:9. */}
              <YouTubeThumb post={post} className={post.isShort ? styles.thumbCompact : undefined} />
              <span className={styles.cardTitle}>{post.title || 'YouTube वीडियो'}</span>
              <span className="visually-hidden"> (YouTube पर देखें)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
