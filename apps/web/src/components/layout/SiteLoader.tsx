'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import styles from './SiteLoader.module.css'

/**
 * Reusable branded loader UI with the LokLens logo and animated progress bar.
 * Used both by Next.js `app/(site)/loading.tsx` and the global route transition loader.
 */
export function SiteLoadingCard({ progress }: { progress?: number }) {
  const isDeterminate = typeof progress === 'number'
  const clamped = isDeterminate ? Math.min(100, Math.max(8, Math.round(progress))) : undefined

  return (
    <div className={styles.card} role="status" aria-live="polite" aria-label="लोक Lens न्यूज़ लोड हो रहा है">
      <div className={styles.logoHalo}>
        <img
          src="/brand/logo-144.webp"
          alt="लोक Lens न्यूज़"
          width={68}
          height={64}
          className={styles.logoImg}
        />
      </div>

      <div className={styles.progressSection}>
        <div className={styles.progressTrack}>
          {isDeterminate ? (
            <div className={styles.progressFill} style={{ width: `${clamped}%` }} />
          ) : (
            <div className={styles.progressIndeterminate} />
          )}
        </div>
        <div className={styles.metaRow}>
          <span className={styles.statusText}>लोक Lens न्यूज़ लोड हो रहा है…</span>
          {isDeterminate && <span className={styles.percentText}>{clamped}%</span>}
        </div>
      </div>
    </div>
  )
}

/**
 * Global navigation loader mounted in `(site)/layout.tsx`.
 * Shows a top progress bar and branded logo + progress card during route transitions.
 */
export function SiteLoader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current)
      finishTimeoutRef.current = null
    }
  }

  // Complete and hide loader whenever route pathname or query changes
  useEffect(() => {
    if (!active) return
    clearTimers()
    setProgress(100)
    finishTimeoutRef.current = setTimeout(() => {
      setActive(false)
      setProgress(0)
    }, 240)
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Intercept internal link clicks to trigger the progress loader immediately
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a')
      if (!anchor) return

      const rawHref = anchor.getAttribute('href')
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        return
      }
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return
      }

      try {
        const dest = new URL(anchor.href, window.location.origin)
        if (dest.origin !== window.location.origin) return
        if (dest.pathname === window.location.pathname && dest.search === window.location.search) {
          return
        }

        clearTimers()
        setActive(true)
        setProgress(18)

        timerRef.current = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) return prev
            const step = prev < 50 ? 14 : prev < 75 ? 7 : 3
            return Math.min(90, prev + step)
          })
        }, 160)
      } catch {
        // Ignore malformed hrefs
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      clearTimers()
    }
  }, [])

  if (!active) return null

  return (
    <>
      <div className={styles.topBarTrack} aria-hidden="true">
        <div className={styles.topBarFill} style={{ width: `${progress}%` }} />
      </div>
      <div className={styles.overlay}>
        <SiteLoadingCard progress={progress} />
      </div>
    </>
  )
}
