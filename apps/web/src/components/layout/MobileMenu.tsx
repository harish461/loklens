'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import type { NavItem } from '@/lib/data/types'

import { Icon } from '../Icon'
import styles from './Header.module.css'

/** Menu button + modal drawer (native <dialog>: focus trap, Esc to close). */
export function MobileMenu({ categories, links }: { categories: NavItem[]; links: NavItem[] }) {
  const ref = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()

  // Close on navigation.
  useEffect(() => {
    ref.current?.close()
  }, [pathname])

  return (
    <>
      <button
        type="button"
        className={styles.iconBtn}
        aria-label="मेन्यू खोलें"
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
      >
        <Icon name="menu" />
      </button>
      <dialog
        ref={ref}
        className={styles.drawer}
        aria-label="मेन्यू"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close() // backdrop click
        }}
      >
        <div className={styles.drawerInner}>
          <div className={styles.drawerHead}>
            <span className={styles.drawerTitle}>श्रेणियां</span>
            <button type="button" className={styles.iconBtn} aria-label="मेन्यू बंद करें" onClick={() => ref.current?.close()}>
              <Icon name="close" />
            </button>
          </div>
          <ul className={styles.drawerList}>
            {categories.map((c) => (
              <li key={c.url}>
                <Link href={c.url}>{c.label}</Link>
              </li>
            ))}
          </ul>
          <ul className={`${styles.drawerList} ${styles.drawerSecondary}`}>
            {links.map((c) => (
              <li key={c.url}>
                <Link href={c.url}>{c.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  )
}
