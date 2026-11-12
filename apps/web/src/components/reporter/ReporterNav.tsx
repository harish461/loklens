'use client'

/**
 * Reporter Desk sidebar. Same markup and styles as the admin sidebar (components/admin/AdminNavClient.tsx,
 * adminNav.module.css) with only the reporter's five items — no admin-only navigation.
 */
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  LayoutGrid,
  LogOut,
  Menu,
  Newspaper,
  UserRound,
  X,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import styles from '../admin/adminNav.module.css'

interface Props {
  userName: string
  userInitials: string
  designation: string
  pendingCount: number
}

interface Item {
  label: string
  href: string
  icon: ReactNode
  badge?: number
  isActive: (path: string) => boolean
}

export function ReporterNav({ userName, userInitials, designation, pendingCount }: Props) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const items: Item[] = [
    { label: 'Dashboard', href: '/reporter', icon: <LayoutGrid size={18} />, isActive: (p) => p === '/reporter' },
    {
      label: 'My Articles',
      href: '/reporter/articles',
      icon: <Newspaper size={18} />,
      badge: pendingCount,
      isActive: (p) => p.startsWith('/reporter/articles') && !p.startsWith('/reporter/articles/new'),
    },
    {
      label: 'Create Article',
      href: '/reporter/articles/new',
      icon: <FilePlus2 size={18} />,
      isActive: (p) => p.startsWith('/reporter/articles/new'),
    },
    { label: 'Profile', href: '/reporter/profile', icon: <UserRound size={18} />, isActive: (p) => p.startsWith('/reporter/profile') },
  ]

  async function signOut() {
    setSigningOut(true)
    // Payload ends the session server-side (removes it from the user's sessions) and clears the cookie.
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => null)
    router.replace('/reporter/login')
    router.refresh()
  }

  return (
    <>
      <button type="button" className={styles.mobileTrigger} onClick={() => setMobileOpen(true)} aria-label="Open navigation menu">
        <Menu size={20} />
      </button>
      {mobileOpen && <div className={styles.backdrop} onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      <nav
        className={`${styles.nav} ${collapsed ? styles.navCollapsed : ''} ${mobileOpen ? styles.navMobileOpen : ''}`}
        aria-label="Reporter navigation"
      >
        <div className={styles.brandHeader}>
          <Link href="/reporter" className={styles.brandLink}>
            <div className={styles.logoRing}>
              <Image src="/brand/logo-96.webp" width={32} height={32} alt="LokLens" unoptimized className={styles.logoImg} />
            </div>
            <div className={styles.brandTextWrap}>
              <span className={styles.brandTitle}>LokLens</span>
              <span className={styles.brandSubtitle}>Reporter Desk</span>
            </div>
          </Link>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button type="button" className={styles.mobileCloseBtn} onClick={() => setMobileOpen(false)} aria-label="Close navigation menu">
            <X size={18} />
          </button>
        </div>

        <div className={styles.scrollArea}>
          <ul className={styles.menuList}>
            {items.map((item) => {
              const active = item.isActive(pathname)
              return (
                <li key={item.href} className={styles.menuItemWrap}>
                  <Link
                    href={item.href}
                    className={`${styles.menuLink} ${active ? styles.menuLinkActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className={styles.iconWrap}>{item.icon}</span>
                    <span className={styles.menuLabel}>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`${styles.badge} ${styles.badgeLime}`} title="Pending review">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
            <li className={styles.menuItemWrap}>
              <button
                type="button"
                className={styles.menuLink}
                onClick={signOut}
                disabled={signingOut}
                title={collapsed ? 'Logout' : undefined}
                style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
              >
                <span className={styles.iconWrap}>
                  <LogOut size={18} />
                </span>
                <span className={styles.menuLabel}>{signingOut ? 'Signing out…' : 'Logout'}</span>
              </button>
            </li>
          </ul>
        </div>

        <div className={styles.footerArea}>
          <div className={styles.promoCard}>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.promoArrowCircle}
              aria-label="Open live LokLens website"
            >
              <ArrowUpRight size={16} />
            </Link>
            <div className={styles.promoVisual} aria-hidden="true">
              <div className={styles.promoLines}>
                <span />
                <span />
                <span />
              </div>
              <div className={styles.promoBars}>
                <span />
                <span />
                <span />
              </div>
            </div>
            <p className={styles.promoText}>
              View Live
              <br />
              <strong>LokLens Portal</strong>
            </p>
          </div>
          <div className={styles.profileBar}>
            <Link href="/reporter/profile" className={styles.profileInfo} title="Profile">
              <span className={styles.profileAvatar}>{userInitials}</span>
              <span className={styles.profileMeta}>
                <span className={styles.profileName}>{userName}</span>
                <span className={styles.profileRole}>{designation || 'Reporter'}</span>
              </span>
            </Link>
            <button type="button" className={styles.logoutBtn} onClick={signOut} aria-label="Log out" title="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>
    </>
  )
}
