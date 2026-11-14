import { getYouTubeLatest, YOUTUBE_CHANNEL_URL } from '@/lib/social'

import { formatRelative } from './format'
import { YouTubeIcon } from './Icon'
import styles from './YouTubeSection.module.css'
import { YouTubeThumb } from './YouTubeThumb'

const YOUTUBE_RED = '#FF0000' // platform colour, used on the icon only

/**
 * Home section: the channel's 3 latest uploads, fetched server-side from the public feed (cached 15 min,
 * tag `social`). Plain links to YouTube — no embedded players or third-party scripts. On failure or an
 * empty feed it shows the subscribe button and a short message instead of empty boxes.
 */
export async function YouTubeSection({ channelUrl = YOUTUBE_CHANNEL_URL }: { channelUrl?: string }) {
  const feed = await getYouTubeLatest(3) // same memoised call as the hero strip
  return (
    <section className={styles.section} aria-labelledby="yt-title">
      <header className={styles.head}>
        <h2 id="yt-title" className={styles.title}>
          <YouTubeIcon size={28} color={YOUTUBE_RED} />
          LokLens YouTube पर
        </h2>
        <a href={channelUrl} target="_blank" rel="noopener" className={styles.subscribe}>
          Subscribe
          <span className="visually-hidden"> (YouTube, नए टैब में खुलेगा)</span>
        </a>
      </header>

      {feed.posts.length === 0 ? (
        <p className={styles.fallback}>ताज़ा वीडियो देखने के लिए हमारा YouTube चैनल सब्सक्राइब करें।</p>
      ) : (
        <ul className={styles.list}>
          {feed.posts.map((post) => (
            <li key={post.id}>
              <a href={post.url} target="_blank" rel="noopener" className={`${styles.card} card`}>
                <YouTubeThumb post={post} className={post.isShort ? styles.thumbShort : styles.thumbVideo} />
                <span className={styles.text}>
                  <span className={styles.postTitle}>{post.title || 'YouTube वीडियो'}</span>
                  <time className={styles.time} dateTime={post.publishedAt}>
                    {formatRelative(post.publishedAt)}
                  </time>
                </span>
                <span className="visually-hidden"> (YouTube पर देखें)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
