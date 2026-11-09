import Link from 'next/link'

import type { Video } from '@/lib/data/types'

import { formatDate } from './format'
import { Icon } from './Icon'
import { NewsImage } from './NewsImage'
import styles from './VideoCard.module.css'

export function VideoCard({ video, tone = 'dark' }: { video: Video; tone?: 'dark' | 'light' }) {
  return (
    <article className={`${styles.card} ${tone === 'light' ? `${styles.light} card` : ''}`}>
      <div className={styles.media}>
        <NewsImage
          image={video.thumbnail}
          displayWidth={300}
          sizes="(min-width: 1024px) 280px, (min-width: 768px) 45vw, 80vw"
        />
        <span className={styles.play} aria-hidden="true">
          <Icon name="play" size={20} />
        </span>
      </div>
      <h3 className={styles.title}>
        <Link href={video.url} className={styles.stretch}>
          <span className="visually-hidden">वीडियो: </span>
          {video.title}
        </Link>
      </h3>
      <time className={styles.meta} dateTime={video.publishedAt}>
        {formatDate(video.publishedAt)}
      </time>
    </article>
  )
}
