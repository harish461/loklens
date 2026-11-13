'use client'

import {
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  Flame,
  FolderTree,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Newspaper,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import styles from './adminNav.module.css'

export interface SidebarCounts {
  articles: number
  breaking: number
  comments: number
  seoIssues: number
  /** Reporter submissions awaiting review. */
  pendingReview: number
}

export interface ExtraEntityItem {
  slug: string
  label: string
  href: string
  count?: number
}

export interface AdminNavClientProps {
  counts: SidebarCounts
  userName: string
  userRole: string
  userEmail: string
  userInitials: string
  extraEntities: ExtraEntityItem[]
  /** Admin-only items (Reporters) are hidden from editors. */
  isAdmin?: boolean
}

type NavKey =
  | 'dashboard'
  | 'articles'
  | 'create-article'
  | 'review'
  | 'reporters'
  | 'categories'
  | 'subcategories'
  | 'media'
  | 'authors'
  | 'breaking'
  | 'comments'
  | 'ads'
  | 'seo'
  | 'analytics'
  | 'users'
  | 'settings'

interface NavItemDef {
  key: NavKey
  label: string
  href: string
  badge?: number | string
  badgeTone?: 'coral' | 'lime' | 'muted'
  isActive: (pathname: string) => boolean
}

function renderNavIcon(key: NavKey, className?: string) {
  const size = 18
  switch (key) {
    case 'dashboard':
      return <LayoutGrid size={size} className={className} />
    case 'articles':
      return <Newspaper size={size} className={className} />
    case 'create-article':
      return <FilePlus2 size={size} className={className} />
    case 'review':
      return <ClipboardCheck size={size} className={className} />
    case 'reporters':
      return <Users size={size} className={className} />
    case 'categories':
      return <FolderTree size={size} className={className} />
    case 'subcategories':
      return <Layers size={size} className={className} />
    case 'media':
      return <ImageIcon size={size} className={className} />
    case 'authors':
      return <UserCheck size={size} className={className} />
    case 'breaking':
      return <Flame size={size} className={className} />
    case 'comments':
      return <MessageSquare size={size} className={className} />
    case 'ads':
      return <Megaphone size={size} className={className} />
    case 'seo':
      return <Globe size={size} className={className} />
    case 'analytics':
      return <BarChart3 size={size} className={className} />
    case 'users':
      return <ShieldCheck size={size} className={className} />
    case 'settings':
      return <Settings size={size} className={className} />
  }
}

export function AdminNavClient({
  counts,
  userName,
  userRole,
  userInitials,
  extraEntities,
  isAdmin = false,
}: AdminNavClientProps) {
  const pathname = usePathname() ?? '/admin'
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    if (collapsed) {
      root.classList.add('admin-nav-collapsed')
    } else {
      root.classList.remove('admin-nav-collapsed')
    }
  }, [collapsed])

  const navItems: NavItemDef[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      href: '/admin',
      isActive: (p) => p === '/admin',
    },
    {
      key: 'articles',
      label: 'News Articles',
      href: '/admin/collections/articles',
      badge: counts.articles > 0 ? counts.articles : undefined,
      badgeTone: 'muted',
      isActive: (p) =>
        p === '/admin/collections/articles' ||
        (p.startsWith('/admin/collections/articles/') && !p.startsWith('/admin/collections/articles/create')),
    },
    {
      key: 'create-article',
      label: 'Create Article',
      href: '/admin/collections/articles/create',
      isActive: (p) => p.startsWith('/admin/collections/articles/create'),
    },
    {
      key: 'review',
      label: 'Review Queue',
      href: '/admin/review',
      badge: counts.pendingReview,
      badgeTone: 'lime',
      isActive: (p) => p.startsWith('/admin/review'),
    },
    ...(isAdmin
      ? [
          {
            key: 'reporters' as const,
            label: 'Reporters',
            href: '/admin/reporters',
            isActive: (p: string) => p.startsWith('/admin/reporters'),
          },
        ]
      : []),
    {
      key: 'categories',
      label: 'Categories',
      href: '/admin/collections/categories',
      isActive: (p) => p.startsWith('/admin/collections/categories'),
    },
    {
      key: 'subcategories',
      label: 'Subcategories',
      href: '/admin/subcategories',
      isActive: (p) => p.startsWith('/admin/subcategories'),
    },
    {
      key: 'media',
      label: 'Media Library',
      href: '/admin/collections/media',
      isActive: (p) => p.startsWith('/admin/collections/media'),
    },
    {
      key: 'authors',
      label: 'Authors / Journalists',
      href: '/admin/authors',
      isActive: (p) => p.startsWith('/admin/authors'),
    },
    {
      key: 'breaking',
      label: 'Breaking News',
      href: '/admin/breaking-news',
      badge: counts.breaking,
      badgeTone: 'coral',
      isActive: (p) => p.startsWith('/admin/breaking-news'),
    },
    {
      key: 'comments',
      label: 'Comments & Moderation',
      href: '/admin/comments',
      badge: counts.comments,
      badgeTone: 'coral',
      isActive: (p) => p.startsWith('/admin/comments'),
    },
    {
      key: 'ads',
      label: 'Advertisements',
      href: '/admin/advertisements',
      isActive: (p) => p.startsWith('/admin/advertisements'),
    },
    {
      key: 'seo',
      label: 'SEO Management',
      href: '/admin/seo',
      badge: counts.seoIssues,
      badgeTone: 'coral',
      isActive: (p) => p.startsWith('/admin/seo') || p.startsWith('/admin/collections/redirects'),
    },
    {
      key: 'analytics',
      label: 'Analytics & Reports',
      href: '/admin/analytics',
      isActive: (p) => p.startsWith('/admin/analytics'),
    },
    {
      key: 'users',
      label: 'Users & Roles',
      href: '/admin/collections/users',
      isActive: (p) => p.startsWith('/admin/collections/users'),
    },
    {
      key: 'settings',
      label: 'Website Settings',
      href: '/admin/globals/site-settings',
      isActive: (p) => p.startsWith('/admin/globals/'),
    },
  ]

  return (
    <>
      {/* Mobile drawer trigger bar */}
      <button
        type="button"
        className={styles.mobileTrigger}
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        className={`${styles.nav} ${collapsed ? styles.navCollapsed : ''} ${mobileOpen ? styles.navMobileOpen : ''}`}
        aria-label="LokLens CMS Navigation"
      >
        {/* Top brand header */}
        <div className={styles.brandHeader}>
          <Link href="/admin" className={styles.brandLink}>
            <div className={styles.logoRing}>
              <Image
                src="/brand/logo-96.webp"
                width={32}
                height={32}
                alt="LokLens"
                unoptimized
                className={styles.logoImg}
              />
            </div>
            <div className={styles.brandTextWrap}>
              <span className={styles.brandTitle}>LokLens</span>
              <span className={styles.brandSubtitle}>Hindi News CMS</span>
            </div>
          </Link>

          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <button
            type="button"
            className={styles.mobileCloseBtn}
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Primary 15 navigation items */}
        <div className={styles.scrollArea}>
          <ul className={styles.menuList}>
            {navItems.map((item) => {
              const active = item.isActive(pathname)
              return (
                <li key={item.key} className={styles.menuItemWrap}>
                  <Link
                    href={item.href}
                    className={`${styles.menuLink} ${active ? styles.menuLinkActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className={styles.iconWrap}>
                      {renderNavIcon(item.key, styles.navIcon)}
                    </span>
                    <span className={styles.menuLabel}>{item.label}</span>
                    {item.badge !== undefined && Number(item.badge) > 0 && (
                      <span
                        className={`${styles.badge} ${
                          item.badgeTone === 'coral'
                            ? styles.badgeCoral
                            : item.badgeTone === 'lime'
                              ? styles.badgeLime
                              : styles.badgeMuted
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Extra Payload collections/globals accordion so Videos, E-Paper, Pages, Tags etc. remain accessible */}
          {extraEntities.length > 0 && !collapsed && (
            <div className={styles.extraGroup}>
              <button
                type="button"
                className={styles.extraToggle}
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
              >
                <span className={styles.extraTitle}>
                  <Sparkles size={14} /> More Content &amp; Tools
                </span>
                <ChevronDown
                  size={15}
                  className={`${styles.extraChevron} ${moreOpen ? styles.extraChevronOpen : ''}`}
                />
              </button>
              {moreOpen && (
                <ul className={styles.extraList}>
                  {extraEntities.map((ext) => {
                    const active = pathname.startsWith(ext.href)
                    return (
                      <li key={ext.slug}>
                        <Link
                          href={ext.href}
                          className={`${styles.extraLink} ${active ? styles.extraLinkActive : ''}`}
                        >
                          <span>{ext.label}</span>
                          {ext.count !== undefined && ext.count > 0 && (
                            <span className={styles.extraCount}>{ext.count}</span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Bottom section: Eduplex-inspired lime card + User profile & Logout */}
        <div className={styles.footerArea}>
          <div className={styles.promoCard}>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.promoArrowCircle}
              aria-label="Open live LokLens website"
              title="Open live LokLens website"
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
            <Link href="/admin/account" className={styles.profileInfo} title="Account settings">
              <span className={styles.profileAvatar}>{userInitials}</span>
              <span className={styles.profileMeta}>
                <span className={styles.profileName}>{userName}</span>
                <span className={styles.profileRole}>{userRole}</span>
              </span>
            </Link>
            <Link
              href="/admin/logout"
              className={styles.logoutBtn}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={16} />
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}

