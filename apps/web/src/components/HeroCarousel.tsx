'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { ArticleCard as Card } from '@/lib/data/types'

import { ArticleCard } from './ArticleCard'
import { Icon } from './Icon'
import styles from './HeroCarousel.module.css'

const AUTO_MS = 6000
const SWIPE_PX = 40
const REDUCED = '(prefers-reduced-motion: reduce)'

function subscribeReduced(onChange: () => void) {
  const mql = window.matchMedia(REDUCED)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}
const getReduced = () => window.matchMedia(REDUCED).matches
const getReducedServer = () => false

/**
 * Hero carousel of the latest stories. All slides are rendered on the server and stacked in one grid
 * cell, so the page is complete without JS and switching slides never changes the layout height.
 * The first slide's image is the priority (LCP) image. Controls are hidden when scripting is off.
 */
export function HeroCarousel({ articles }: { articles: Card[] }) {
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touchX, setTouchX] = useState<number | null>(null)
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, getReducedServer)
  const count = articles.length
  const paused = hovered || focused || reduced

  const go = (next: number) => setIndex(((next % count) + count) % count)

  // Auto-advance every AUTO_MS; paused on hover/focus and under reduced motion.
  useIntervalWhen(!paused && count > 1, AUTO_MS, () => setIndex((i) => (i + 1) % count))

  return (
    <section
      className={styles.root}
      role="region"
      aria-roledescription="carousel"
      aria-label="मुख्य खबरें"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1)
        if (e.key === 'ArrowLeft') go(index - 1)
      }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const end = e.changedTouches[0]?.clientX
        if (touchX === null || end === undefined) return
        const dx = end - touchX
        if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? index + 1 : index - 1)
        setTouchX(null)
      }}
    >
      <div className={styles.viewport}>
        {articles.map((a, i) => (
          <div
            key={a.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            aria-hidden={i !== index}
            className={`${styles.slide} ${i === index ? styles.active : ''}`}
          >
            <ArticleCard article={a} variant="hero" priority={i === 0} headingLevel="h2" />
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => go(index - 1)}
            aria-label="पिछली खबर"
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className={styles.dots}>
            {articles.map((a, i) => (
              <button
                key={a.id}
                type="button"
                className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
                onClick={() => go(i)}
                aria-label={`खबर ${i + 1} दिखाएं`}
                aria-current={i === index ? 'true' : undefined}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => go(index + 1)}
            aria-label="अगली खबर"
          >
            <Icon name="chevronRight" size={22} />
          </button>
        </div>
      )}
    </section>
  )
}


/** Runs fn every ms while active; the latest fn is kept in a ref so the timer is not reset on re-render. */
function useIntervalWhen(active: boolean, ms: number, fn: () => void) {
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => fnRef.current(), ms)
    return () => window.clearInterval(id)
  }, [active, ms])
}
