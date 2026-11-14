import Link from 'next/link'
import type { ReactNode } from 'react'

import type { ArticleCard as Card } from '@/lib/data/types'

import { ArticleCard } from './ArticleCard'
import styles from './SectionBlock.module.css'

interface Props {
  title: string
  /** "और देखें" target. */
  href?: string
  articles?: Card[]
  /** How many items after the lead render as plain links. */
  links?: number
  children?: ReactNode
  id: string
}

/** Section title + "और देखें", lead card, then plain links with top borders. */
export function SectionBlock({ title, href, articles, links = 2, children, id }: Props) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <header className={styles.head}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {href && (
          <Link href={href} className={styles.more}>
            View All →<span className="visually-hidden">: {title}</span>
          </Link>
        )}
      </header>
      {articles && articles.length > 0 && (
        <>
          <ArticleCard article={articles[0]} variant="large" showCategory={false} />
          <div className={styles.links}>
            {articles.slice(1, 1 + links).map((a) => (
              <ArticleCard key={a.id} article={a} variant="link" />
            ))}
          </div>
        </>
      )}
      {children}
    </section>
  )
}
