'use client'

import styles from './adminNav.module.css'

/**
 * Collapses the sidebar to icons. The state is a class on <html> (admin-nav-collapsed), which the CSS reads,
 * so nothing else in the admin has to know about it. Not persisted: a reload shows the sidebar expanded.
 */
export function AdminNavToggle() {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label="Collapse or expand the sidebar"
      onClick={() => {
        const root = document.documentElement
        root.classList.toggle('admin-nav-collapsed')
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" focusable="false">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M9 4v16" />
      </svg>
    </button>
  )
}
