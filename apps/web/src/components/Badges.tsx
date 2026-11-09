import Link from 'next/link'

import type { CategoryRef } from '@/lib/data/types'

import styles from './Badges.module.css'

export function CategoryLabel({ category, link = true }: { category: CategoryRef; link?: boolean }) {
  if (!link) return <span className={styles.category}>{category.name}</span>
  return (
    <Link href={`/${category.slug}`} className={styles.category}>
      {category.name}
    </Link>
  )
}

/** Yellow "ब्रेकिंग" badge — the only use of the breaking colour. Always carries text. */
export function BreakingBadge() {
  return <span className={styles.breaking}>ब्रेकिंग</span>
}

/** Pulsing red dot + "लाइव" (no pulse with prefers-reduced-motion). */
export function LiveDot() {
  return (
    <span className={styles.live}>
      <span className={styles.dot} aria-hidden="true" />
      लाइव
    </span>
  )
}
