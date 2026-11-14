'use client'

import Link from 'next/link'
import { useId, useState } from 'react'

import type { ArticleCard as Card, CategoryRef } from '@/lib/data/types'

import { ArticleCard } from './ArticleCard'
import styles from './CategoryTabs.module.css'

export interface CategoryTab {
  category: CategoryRef
  articles: Card[]
}

/**
 * Category tabs for the home hero. Each tab shows that category's three newest stories as cards.
 * Only the selected panel is rendered. Tabs without stories are left out by the caller.
 */
export function CategoryTabs({ tabs, title }: { tabs: CategoryTab[]; title: string }) {
  const [selected, setSelected] = useState(0)
  const baseId = useId()
  if (tabs.length === 0) return null
  const active = tabs[Math.min(selected, tabs.length - 1)]
  const cards = active.articles.slice(0, 3)

  return (
    <section className={styles.wrap} aria-labelledby={`${baseId}-title`}>
      <div className={styles.headerRow}>
        <div className={styles.titleWrap}>
          <span className={styles.badge} aria-hidden="true">Coverage</span>
          <h2 id={`${baseId}-title`} className={styles.title}>
            {title}
          </h2>
        </div>
        <Link href={`/${active.category.slug}`} className={styles.topMore}>
          View All →
        </Link>
      </div>

      <div role="tablist" aria-label={title} className={styles.tabs}>
        {tabs.map((t, i) => {
          const isOn = i === selected
          return (
            <button
              key={t.category.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${i}`}
              aria-selected={isOn}
              aria-controls={`${baseId}-panel`}
              tabIndex={isOn ? 0 : -1}
              className={`${styles.tab} ${isOn ? styles.tabOn : ''}`}
              onClick={() => setSelected(i)}
            >
              <span className={styles.tabDot} aria-hidden="true" />
              <span>{t.category.name}</span>
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${selected}`} className={styles.panel}>
        <div className={styles.cardsGrid}>
          {cards[0] && (
            <div className={styles.leadCard}>
              <ArticleCard article={cards[0]} variant="large" headingLevel="h3" />
            </div>
          )}
          {cards.slice(1).length > 0 && (
            <div className={styles.subCards}>
              {cards.slice(1).map((a) => (
                <div key={a.id} className={styles.subCardItem}>
                  <ArticleCard article={a} variant="list" headingLevel="h3" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.footerRow}>
          <Link href={`/${active.category.slug}`} className={styles.moreBtn}>
            <span>View All Stories</span>
            <span aria-hidden="true" className={styles.arrowIcon}>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
