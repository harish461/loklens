import type { SocialPost } from '@/lib/social'

import { Icon } from './Icon'

import styles from './YouTubeThumb.module.css'

/**
 * YouTube thumbnail in a fixed aspect box (9:16 for Shorts, 16:9 for videos) so nothing shifts while it
 * loads. Plain <img> from i.ytimg.com, always lazy and low priority: it must never compete with the
 * lead story image for LCP.
 */
export function YouTubeThumb({ post, className }: { post: SocialPost; className?: string }) {
  return (
    <span className={`${styles.box} ${post.isShort ? styles.short : styles.video} ${className ?? ''}`}>
      {post.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumbnail.url}
          width={post.thumbnail.width}
          height={post.thumbnail.height}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          referrerPolicy="no-referrer"
        />
      )}
      {post.isShort && <span className={styles.label}>Shorts</span>}
      <span className={styles.play} aria-hidden="true">
        <Icon name="play" size={18} />
      </span>
    </span>
  )
}
