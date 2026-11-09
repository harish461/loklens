import type { SocialPost } from '@/lib/social'

import { formatRelative } from './format'
import { YouTubeIcon } from './Icon'
import styles from './YouTubeVideos.module.css'
import { YouTubeThumb } from './YouTubeThumb'

const YOUTUBE_RED = '#FF0000'

/**
 * Regular (non-Shorts) uploads, 16:9 cards. Takes the posts from the page's shared feed read, so no extra
 * request. Renders nothing when the list is empty: no heading and no empty box.
 */
export function YouTubeVideos({ posts, channelUrl }: { posts: SocialPost[]; channelUrl: string }) {
  if (posts.length === 0) return null
  return (
    <section className={styles.section} aria-labelledby="yt-videos-title">
      <div className={styles.head}>
        <h2 id="yt-videos-title" className={styles.title}>
          <YouTubeIcon size={22} color={YOUTUBE_RED} />
          YouTube वीडियो
        </h2>
        <a href={channelUrl} target="_blank" rel="noopener" className={styles.subscribe}>
          सब्सक्राइब करें
          <span className="visually-hidden"> (YouTube, नए टैब में खुलेगा)</span>
        </a>
      </div>
      <ul className={styles.list}>
        {posts.map((post) => (
          <li key={post.id}>
            <a href={post.url} target="_blank" rel="noopener" className={`${styles.card} card`}>
              <YouTubeThumb post={post} />
              <span className={styles.cardTitle}>{post.title || 'YouTube वीडियो'}</span>
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
