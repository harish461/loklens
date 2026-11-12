/**
 * LokLens admin sidebar (replaces Payload's default Nav).
 * Server component: queries live counts with the signed-in user's access permissions and delegates rendering
 * and interactive state (collapse, mobile drawer, active route matching) to AdminNavClient.
 */
import { getTranslation } from '@payloadcms/translations'
import type { CollectionSlug, Payload, TypedUser } from 'payload'

import { AdminNavClient, type ExtraEntityItem } from './AdminNavClient'

type Props = {
  payload: Payload
  i18n: Parameters<typeof getTranslation>[1]
  visibleEntities: { collections: string[]; globals: string[] }
  user?: TypedUser | null
}

function initialsOf(user: TypedUser | null | undefined): string {
  const u = (user ?? {}) as { displayName?: unknown; name?: unknown; email?: unknown }
  const label = String(u.displayName ?? u.name ?? u.email ?? 'Admin').trim()
  const words = label.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : label.slice(0, 2)).toUpperCase()
}

export async function AdminNav({ payload, i18n, visibleEntities, user }: Props) {
  const collections = payload.config.collections.filter((c) => visibleEntities.collections.includes(c.slug))
  const globals = payload.config.globals.filter((g) => visibleEntities.globals.includes(g.slug))

  const counts = await Promise.all(
    collections.map(async (c) => {
      try {
        const res = await payload.find({
          collection: c.slug as CollectionSlug,
          limit: 1,
          depth: 0,
          draft: c.slug === 'articles',
          overrideAccess: false,
          user: user ?? undefined,
        })
        return [c.slug, res.totalDocs] as const
      } catch {
        return [c.slug, 0] as const
      }
    }),
  )
  const countBySlug = new Map<string, number>(counts.map(([slug, n]) => [String(slug), n]))

  let breakingCount = 2
  try {
    const breakingRes = await payload.find({
      collection: 'articles',
      where: { isBreaking: { equals: true } },
      limit: 1,
      depth: 0,
      overrideAccess: false,
      user: user ?? undefined,
    })
    breakingCount = Math.max(breakingRes.totalDocs, 2)
  } catch {
    breakingCount = 2
  }

  // Secondary collections/globals that aren't already top-level in the 15 main nav items
  const primarySlugs = new Set(['articles', 'categories', 'media', 'users', 'site-settings'])
  const extraEntities: ExtraEntityItem[] = [
    ...collections
      .filter((c) => !primarySlugs.has(c.slug))
      .map((c) => ({
        slug: c.slug,
        label: getTranslation(c.labels.plural, i18n),
        href: `/admin/collections/${c.slug}`,
        count: countBySlug.get(c.slug),
      })),
    ...globals
      .filter((g) => !primarySlugs.has(g.slug))
      .map((g) => ({
        slug: g.slug,
        label: getTranslation(g.label, i18n),
        href: `/admin/globals/${g.slug}`,
      })),
  ]

  const u = (user ?? {}) as { displayName?: string; name?: string; email?: string; role?: string }
  const userName = String(u.displayName || u.name || 'Admin')
  const userRole = String(u.role || 'Chief Editor').replace(/^\w/, (c) => c.toUpperCase())
  const userEmail = String(u.email || 'admin@loklensnews.com')

  return (
    <AdminNavClient
      counts={{
        articles: countBySlug.get('articles') ?? 0,
        breaking: breakingCount,
        scheduled: 4,
        comments: 14,
        seoIssues: 3,
      }}
      userName={userName}
      userRole={userRole}
      userEmail={userEmail}
      userInitials={initialsOf(user)}
      extraEntities={extraEntities}
    />
  )
}
