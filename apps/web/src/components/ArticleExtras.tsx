import Link from 'next/link'

import type { ArticleCard as Card, SiteSettings, TagRef } from '@/lib/data/types'

import { ArticleCard } from './ArticleCard'
import { WhatsAppIcon } from './Icon'
import styles from './ui.module.css'

export function TagChips({ tags }: { tags: TagRef[] }) {
  if (tags.length === 0) return null
  return (
    <ul className={styles.chips} aria-label="टैग">
      {tags.map((t) => (
        <li key={t.id}>
          <Link href={`/tag/${t.slug}`}>#{t.name}</Link>
        </li>
      ))}
    </ul>
  )
}

export function RelatedList({ articles, title = 'ये भी पढ़ें' }: { articles: Card[]; title?: string }) {
  if (articles.length === 0) return null
  return (
    <section aria-labelledby="related-title">
      <h2 id="related-title" className={styles.sectionTitle}>
        {title}
      </h2>
      {articles.map((a) => (
        <ArticleCard key={a.id} article={a} variant="list" />
      ))}
    </section>
  )
}

/** Shown only when settings have a WhatsApp channel link (social platform "whatsapp"). */
export function WhatsAppChannelBanner({ settings }: { settings: SiteSettings }) {
  const channel = settings.social.find((s) => s.platform === 'whatsapp')
  if (!channel) return null
  return (
    <aside className={styles.wa} aria-label="WhatsApp चैनल">
      <span className={styles.waIcon}>
        <WhatsAppIcon size={24} />
      </span>
      <div className={styles.waText}>
        <p className={styles.waTitle}>ताज़ा खबरें WhatsApp पर पाएं</p>
        <p className={styles.waSub}>लोक Lens न्यूज़ का WhatsApp चैनल फॉलो करें</p>
      </div>
      <a className={styles.waBtn} href={channel.url} target="_blank" rel="noopener noreferrer">
        चैनल जॉइन करें
      </a>
    </aside>
  )
}
