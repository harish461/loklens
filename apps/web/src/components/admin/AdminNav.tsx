/**
 * LokLens admin sidebar (replaces Payload's default Nav, UI only). Items are built from Payload's own config and
 * the `visibleEntities` Payload passes in, which already reflect each user's access, so permissions still apply.
 * Every link points at the same Payload admin route as before; nothing is renamed, added or removed.
 */
import { getTranslation } from '@payloadcms/translations'
import { Logout } from '@payloadcms/ui'
import Image from 'next/image'
import type { CollectionSlug, Payload, TypedUser } from 'payload'

import { NavLink } from '../layout/NavLink'
import styles from './adminNav.module.css'
import { AdminNavToggle } from './AdminNavToggle'

type Props = {
  payload: Payload
  i18n: Parameters<typeof getTranslation>[1]
  visibleEntities: { collections: string[]; globals: string[] }
  user?: TypedUser | null
}

/** Sidebar groups by collection/global slug. Anything visible but not listed goes to "Site". */
const GROUPS: { title: string; slugs: string[] }[] = [
  { title: 'Content', slugs: ['articles', 'videos', 'epapers', 'pages', 'media'] },
  { title: 'Taxonomy', slugs: ['categories', 'tags', 'locations'] },
  { title: 'Site', slugs: ['redirects', 'users', 'site-settings', 'navigation', 'ticker'] },
]

type Item = { href: string; label: string; slug: string; count?: number }

/** Shown instead of an icon when the sidebar is collapsed: the first character of the label. */
function initial(label: string): string {
  return Array.from(label.trim())[0] ?? ''
}

export async function AdminNav({ payload, i18n, visibleEntities, user }: Props) {
  const collections = payload.config.collections.filter((c) => visibleEntities.collections.includes(c.slug))
  const globals = payload.config.globals.filter((g) => visibleEntities.globals.includes(g.slug))

  // Counts for collection badges, read with the signed-in user's access.
  const counts = await Promise.all(
    collections.map(async (c) => {
      const res = await payload.find({ collection: c.slug as CollectionSlug, limit: 1, depth: 0, overrideAccess: false, user: user ?? undefined })
      return [c.slug, res.totalDocs] as const
    }),
  )
  const countBySlug = new Map<string, number>(counts.map(([slug, n]) => [String(slug), n]))

  const itemFor = (slug: string, label: string, isGlobal: boolean): Item =>
    isGlobal
      ? { href: `/admin/globals/${slug}`, label, slug }
      : { href: `/admin/collections/${slug}`, label, slug, count: countBySlug.get(slug) }

  const entries = new Map<string, Item>()
  for (const c of collections) entries.set(c.slug, itemFor(c.slug, getTranslation(c.labels.plural, i18n), false))
  for (const g of globals) entries.set(g.slug, itemFor(g.slug, getTranslation(g.label, i18n), true))

  const placed = new Set<string>()
  const groups = GROUPS.map((g) => {
    const items = g.slugs.map((s) => entries.get(s)).filter((x): x is Item => Boolean(x))
    items.forEach((i) => placed.add(i.slug))
    return { title: g.title, items }
  })
  const leftovers = [...entries.values()].filter((i) => !placed.has(i.slug))
  if (leftovers.length) groups[groups.length - 1].items.push(...leftovers)

  return (
    <nav className={styles.nav} aria-label="Admin navigation">
      {/* Collapse control first, at the top-left, above the logo. */}
      <div className={styles.topRow}>
        <AdminNavToggle />
      </div>
      <div className={styles.head}>
        <Image src="/brand/logo-96.webp" width={36} height={36} alt="LokLens" unoptimized className={styles.logo} />
        <span className={styles.brand}>LokLens</span>
      </div>

      <ul className={styles.list}>
        <li>
          <NavLink href="/admin" exact className={styles.item}>
            <span className={styles.letter} aria-hidden="true">{initial('Dashboard')}</span>
            <span className={styles.label}>Dashboard</span>
          </NavLink>
        </li>

        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <li key={g.title}>
              <details className={styles.group} open>
                <summary className={styles.groupTitle}>
                  <span className={styles.label}>{g.title}</span>
                  <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" focusable="false">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <ul className={styles.sub}>
                  {g.items.map((item) => (
                    <li key={item.slug}>
                      <NavLink href={item.href} className={styles.item}>
                        <span className={styles.letter} aria-hidden="true">{initial(item.label)}</span>
                        <span className={styles.label}>{item.label}</span>
                        {item.count !== undefined && item.count > 0 && <span className={styles.badge}>{item.count}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
      </ul>

      <ul className={styles.foot}>
        <li>
          <NavLink href="/admin/account" className={styles.item}>
            <span className={styles.letter} aria-hidden="true">{initial('Settings')}</span>
            <span className={styles.label}>Settings</span>
          </NavLink>
        </li>
        <li>
          <a href="https://payloadcms.com/docs" target="_blank" rel="noopener noreferrer" className={styles.item}>
            <span className={styles.letter} aria-hidden="true">{initial('Help')}</span>
            <span className={styles.label}>Help &amp; Support</span>
          </a>
        </li>
        <li className={styles.logout}>
          <Logout />
        </li>
      </ul>
    </nav>
  )
}
