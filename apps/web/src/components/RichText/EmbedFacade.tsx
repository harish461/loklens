'use client'

import { useState } from 'react'

import { Icon } from '../Icon'
import styles from './RichText.module.css'

const LABELS: Record<string, string> = {
  youtube: 'YouTube',
  x: 'X (Twitter)',
  instagram: 'Instagram',
  facebook: 'Facebook',
}

/**
 * Click-to-load facade: nothing from the third party loads until the reader asks for it.
 * YouTube plays inline (youtube-nocookie); other providers open in a new tab.
 */
export function EmbedFacade({ provider, url, youtubeId }: { provider: string; url: string; youtubeId: string | null }) {
  const [active, setActive] = useState(false)
  const label = LABELS[provider] ?? provider

  if (provider === 'youtube' && youtubeId) {
    if (active) {
      return (
        <div className={styles.embed}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
            title="YouTube वीडियो"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )
    }
    return (
      <div className={styles.embed}>
        <button type="button" className={styles.facade} onClick={() => setActive(true)}>
          <span className={styles.playBtn} aria-hidden="true">
            <Icon name="play" size={28} />
          </span>
          <span>वीडियो चलाएं</span>
          <span className={styles.facadeNote}>क्लिक करने पर YouTube से वीडियो लोड होगा</span>
        </button>
      </div>
    )
  }

  return (
    <a className={styles.external} href={url} target="_blank" rel="noopener noreferrer">
      <span>{label} पर पोस्ट देखें</span>
      <Icon name="chevronRight" size={18} />
    </a>
  )
}
