/**
 * Route names that a category slug may never take (architecture §3), because categories live at
 * the URL root (`/{category}`) next to these fixed routes.
 */
export const RESERVED_SLUGS: readonly string[] = [
  'tag',
  'author',
  'video',
  'e-paper',
  'search',
  'about',
  'contact',
  'advertise',
  'privacy-policy',
  'terms',
  'editorial-policy',
  'corrections-policy',
  'disclaimer',
  'admin',
  'api',
  'legacy',
  'media',
  'rss.xml',
  'sitemap.xml',
  'news-sitemap.xml',
  'page',
  '_next',
  'reporter',
  'preview',
] as const

const RESERVED = new Set(RESERVED_SLUGS)

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.trim().toLowerCase())
}
