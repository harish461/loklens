import type { SocialPost } from '@/lib/social'

import { formatRelative } from './format'
import { YouTubeIcon } from './Icon'
import styles from './YouTubeShorts.module.css'
import { YouTubeThumb } from './YouTubeThumb'

const YOUTUBE_RED = '#FF0000'

/**
 * Full-width row of the latest YouTube Shorts. Phones: horizontal scroll. Desktop: one row, cards capped in width
 * so the tall 9:16 thumbnails keep the band short. Renders nothing when there are no Shorts.
 */
export function YouTubeShorts({
  shorts,
  channelUrl,
  variant = 'row',
}: {
  shorts: SocialPost[]
  channelUrl: string
  /** row: full-width band. compact: narrow column, three across with smaller titles. */
  variant?: 'row' | 'compact'
}) {
  if (shorts.length === 0) return null
  return (
    <section
      className={variant === 'compact' ? `${styles.section} ${styles.compact}` : styles.section}
      aria-labelledby="yt-shorts-title"
    >
      <div className={styles.head}>
        <h2 id="yt-shorts-title" className={styles.title}>
          <YouTubeIcon size={22} color={YOUTUBE_RED} />
          YouTube शॉर्ट्स
        </h2>
        <a href={channelUrl} target="_blank" rel="noopener" className={styles.subscribe}>
          सब्सक्राइब करें
          <span className="visually-hidden"> (YouTube, नए टैब में खुलेगा)</span>
        </a>
      </div>
      <ul className={styles.row}>
        {shorts.map((post) => (
          <li key={post.id}>
            <a href={post.url} target="_blank" rel="noopener" className={`${styles.card} card`}>
              <YouTubeThumb post={post} />
              <span className={styles.cardTitle}>{post.title || 'YouTube शॉर्ट्स'}</span>
              <time className={styles.time} dateTime={post.publishedAt}>
                {formatRelative(post.publishedAt)}
              </time>
              <span className="visually-hidden"> (YouTube पर देखें)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
