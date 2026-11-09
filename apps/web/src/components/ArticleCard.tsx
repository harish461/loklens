import Link from 'next/link'

import type { ArticleCard as Card } from '@/lib/data/types'

import styles from './ArticleCard.module.css'
import { BreakingBadge, CategoryLabel } from './Badges'
import { formatDateTime } from './format'
import { NewsImage } from './NewsImage'

export type ArticleCardVariant = 'hero' | 'large' | 'list' | 'numbered' | 'link'

interface Props {
  article: Card
  variant?: ArticleCardVariant
  /** list variant: thumbnail side (category pages put it left). */
  thumb?: 'left' | 'right'
  /** numbered variant: the numeral to show. */
  index?: number
  /** Above-the-fold image (hero): eager + high priority for LCP. */
  priority?: boolean
  showCategory?: boolean
  headingLevel?: 'h2' | 'h3'
}

function Meta({ article }: { article: Card }) {
  return (
    <time className={styles.meta} dateTime={article.publishedAt}>
      {formatDateTime(article.publishedAt)}
    </time>
  )
}

export function ArticleCard({
  article,
  variant = 'list',
  thumb = 'right',
  index,
  priority = false,
  showCategory = true,
  headingLevel = 'h3',
}: Props) {
  const H = headingLevel
  const kicker =
    showCategory || article.isBreaking ? (
      <div className={styles.kicker}>
        {article.isBreaking && <BreakingBadge />}
        {showCategory && <CategoryLabel category={article.category} />}
      </div>
    ) : null

  if (variant === 'numbered' || variant === 'link') {
    return (
      <article className={variant === 'numbered' ? styles.numbered : styles.link}>
        {variant === 'numbered' && (
          <span className={styles.numeral} aria-hidden="true">
            {index}
          </span>
        )}
        <div>
          <H className={styles.titleList}>
            <Link href={article.url} className={styles.stretch}>
              {article.title}
            </Link>
          </H>
          {variant === 'numbered' && <Meta article={article} />}
        </div>
      </article>
    )
  }

  if (variant === 'list') {
    return (
      <article className={`${styles.list} ${thumb === 'left' ? styles.thumbLeft : ''}`}>
        <div className={styles.listText}>
          {kicker}
          <H className={styles.titleList}>
            <Link href={article.url} className={styles.stretch}>
              {article.title}
            </Link>
          </H>
          <Meta article={article} />
        </div>
        <div className={styles.thumb}>
          <NewsImage image={article.image} displayWidth={136} preferred="thumb" sizes="136px" />
        </div>
      </article>
    )
  }

  const hero = variant === 'hero'
  return (
    <article className={hero ? styles.hero : styles.large}>
      <div className={styles.media}>
        <NewsImage
          image={article.image}
          displayWidth={hero ? 800 : 400}
          sizes={
            hero
              ? '(min-width: 1024px) 760px, 100vw'
              : '(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw'
          }
          priority={priority}
        />
      </div>
      <div className={styles.body}>
        {kicker}
        <H className={hero ? styles.titleHero : styles.titleLarge}>
          <Link href={article.url} className={styles.stretch}>
            {article.title}
          </Link>
        </H>
        {hero && <p className={styles.summary}>{article.summary}</p>}
        <Meta article={article} />
      </div>
    </article>
  )
}
