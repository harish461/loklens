'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { ArticleCard as Card } from '@/lib/data/types'

import { BreakingBadge } from './Badges'
import { formatDateTime } from './format'
import { Icon } from './Icon'
import { NewsImage } from './NewsImage'
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
 * Broadcast Thumbnail Hero Slider for the homepage (up to 10 latest stories).
 * Features a high-contrast frosted caption panel for crystal-clear Hindi text readability
 * over bright photos, plus an interactive scrollable thumbnail strip at the bottom.
 */
export function HeroCarousel({ articles }: { articles: Card[] }) {
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touchX, setTouchX] = useState<number | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])

  const reduced = useSyncExternalStore(subscribeReduced, getReduced, getReducedServer)
  const count = articles.length
  const paused = hovered || focused || reduced

  const go = (next: number) => {
    if (count === 0) return
    setIndex(((next % count) + count) % count)
  }

  useIntervalWhen(!paused && count > 1, AUTO_MS, () => setIndex((i) => (i + 1) % count))

  // Horizontally center the active thumbnail inside the strip without scrolling the window
  useEffect(() => {
    const strip = stripRef.current
    const thumb = thumbRefs.current[index]
    if (!strip || !thumb) return
    const targetLeft = thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2
    strip.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [index, reduced])

  if (count === 0) return null

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
      {/* Main Hero Stage */}
      <div className={styles.stage}>
        <div className={styles.viewport}>
          {articles.map((a, i) => {
            const isActive = i === index
            return (
              <article
                key={a.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${count}`}
                aria-hidden={!isActive}
                className={`${styles.slide} ${isActive ? styles.active : ''}`}
              >
                {/* Hero Image */}
                <Link href={a.url} tabIndex={isActive ? 0 : -1} className={styles.mediaLink}>
                  <NewsImage
                    image={a.image}
                    displayWidth={880}
                    preferred="wide"
                    sizes="(min-width: 1024px) 840px, 100vw"
                    priority={i === 0}
                  />
                  <span className={styles.imageScrim} aria-hidden="true" />
                </Link>

                {/* Top Meta Bar: Category Pill + Slide Counter */}
                <div className={styles.topBar}>
                  <div className={styles.kickerBadges}>
                    {a.isBreaking && <BreakingBadge />}
                    <Link
                      href={`/${a.category.slug}`}
                      tabIndex={isActive ? 0 : -1}
                      className={styles.categoryBadge}
                    >
                      {a.category.name}
                    </Link>
                  </div>

                  <div className={styles.topControls}>
                    <span className={styles.counterPill} aria-hidden="true">
                      {String(i + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
                    </span>
                    {count > 1 && (
                      <div className={styles.navBtns}>
                        <button
                          type="button"
                          className={styles.navBtn}
                          onClick={() => go(index - 1)}
                          aria-label="पिछली खबर"
                          tabIndex={isActive ? 0 : -1}
                        >
                          <Icon name="chevronLeft" size={18} />
                        </button>
                        <button
                          type="button"
                          className={styles.navBtn}
                          onClick={() => go(index + 1)}
                          aria-label="अगली खबर"
                          tabIndex={isActive ? 0 : -1}
                        >
                          <Icon name="chevronRight" size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compact Editorial Caption Panel: Date at Top-Right + 1-Line Ellipsis Heading */}
                <div className={styles.captionOverlay}>
                  <div className={styles.captionBox}>
                    <div className={styles.dateTopRow}>
                      <time className={styles.timestamp} dateTime={a.publishedAt}>
                        {formatDateTime(a.publishedAt)}
                      </time>
                    </div>
                    <h2 className={styles.headline}>
                      <Link
                        href={a.url}
                        tabIndex={isActive ? 0 : -1}
                        className={styles.headlineLink}
                        title={a.title}
                      >
                        {a.title}
                      </Link>
                    </h2>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {/* Bottom Thumbnail Slider Strip (Up to 10 Latest Stories) */}
      {count > 1 && (
        <div className={styles.thumbDock}>
          <div className={styles.thumbHeader}>
            <span className={styles.thumbSectionLabel}>
              <span className={styles.thumbDot} aria-hidden="true" />
              प्रमुख {count} ताज़ा खबरें
            </span>
            <div className={styles.thumbScrollBtns}>
              <button
                type="button"
                className={styles.thumbArrow}
                onClick={() => go(index - 1)}
                aria-label="पिछली थंबनेल खबर"
              >
                <Icon name="chevronLeft" size={16} />
              </button>
              <button
                type="button"
                className={styles.thumbArrow}
                onClick={() => go(index + 1)}
                aria-label="अगली थंबनेल खबर"
              >
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
          </div>

          <div ref={stripRef} className={styles.thumbStrip} role="tablist" aria-label="खबरें चुनें">
            {articles.map((a, i) => {
              const isSelected = i === index
              return (
                <button
                  key={a.id}
                  ref={(el) => {
                    thumbRefs.current[i] = el
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={`${i + 1}: ${a.title}`}
                  onClick={() => go(i)}
                  className={`${styles.thumbCard} ${isSelected ? styles.thumbCardActive : ''}`}
                >
                  <span className={styles.thumbMedia}>
                    <NewsImage
                      image={a.image}
                      displayWidth={120}
                      preferred="thumb"
                      sizes="120px"
                    />
                    <span className={styles.thumbIndex}>{String(i + 1).padStart(2, '0')}</span>
                  </span>
                  <span className={styles.thumbText}>
                    <span className={styles.thumbCat}>{a.category.name}</span>
                    <span className={styles.thumbTitle}>{a.title}</span>
                  </span>
                </button>
              )
            })}
          </div>
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
