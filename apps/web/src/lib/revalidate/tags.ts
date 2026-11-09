/**
 * Cache-tag scheme (architecture §4). Pure functions shared by the Payload hooks (which expire tags)
 * and the read helpers in src/lib/data (which attach them).
 */
export const cacheTags = {
  article: (id: number | string) => `article:${id}`,
  category: (slug: string) => `list:category:${slug}`,
  tag: (slug: string) => `list:tag:${slug}`,
  author: (slug: string) => `list:author:${slug}`,
  home: 'home',
  feeds: 'feeds',
  settings: 'settings',
  // Additions proposed to architecture §4 (no tag was defined for these types):
  page: (slug: string) => `page:${slug}`,
  video: (slug: string) => `video:${slug}`,
  videos: 'list:videos',
  epaper: (date: string) => `epaper:${date}`,
  epapers: 'list:epapers',
  redirects: 'redirects',
} as const

export const CACHE_TAG_PATTERN = /^[a-z0-9:_.-]{1,200}$/i

type Slug = string | null | undefined

function uniq(values: Array<string | null | undefined | false>): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0))]
}

export interface ArticleTagInput {
  id: number | string
  /** Slugs of the current AND previous category (so the old listing is refreshed too). */
  categorySlugs: Slug[]
  tagSlugs: Slug[]
  authorSlugs: Slug[]
}

export function tagsForArticle({ id, categorySlugs, tagSlugs, authorSlugs }: ArticleTagInput): string[] {
  return uniq([
    cacheTags.article(id),
    ...categorySlugs.map((s) => s && cacheTags.category(s)),
    ...tagSlugs.map((s) => s && cacheTags.tag(s)),
    ...authorSlugs.map((s) => s && cacheTags.author(s)),
    cacheTags.home,
    cacheTags.feeds,
  ])
}

/** Category rename/slug change: both listings, home sections, feeds, and navigation (settings). */
export function tagsForCategory(slugs: Slug[]): string[] {
  return uniq([...slugs.map((s) => s && cacheTags.category(s)), cacheTags.home, cacheTags.feeds, cacheTags.settings])
}

export function tagsForTag(slugs: Slug[]): string[] {
  return uniq([...slugs.map((s) => s && cacheTags.tag(s)), cacheTags.feeds])
}

export function tagsForAuthor(slugs: Slug[]): string[] {
  return uniq([...slugs.map((s) => s && cacheTags.author(s)), cacheTags.feeds])
}

export function tagsForPage(slugs: Slug[]): string[] {
  return uniq([...slugs.map((s) => s && cacheTags.page(s)), cacheTags.feeds])
}

export function tagsForVideo(slugs: Slug[]): string[] {
  return uniq([...slugs.map((s) => s && cacheTags.video(s)), cacheTags.videos, cacheTags.home, cacheTags.feeds])
}

export function tagsForEPaper(dates: Slug[]): string[] {
  return uniq([...dates.map((d) => d && cacheTags.epaper(d)), cacheTags.epapers, cacheTags.feeds])
}

/** Canonical article path (contract §4): /{category}/{slug}-{id} */
export function articlePath(categorySlug: string, slug: string, id: number | string): string {
  return `/${categorySlug}/${slug}-${id}`
}

/** Public URLs worth purging at the CDN when an article changes. */
export function purgePathsForArticle(input: {
  id: number | string
  slug: Slug
  previousSlug?: Slug
  categorySlug: Slug
  previousCategorySlug?: Slug
}): string[] {
  const { id, slug, previousSlug, categorySlug, previousCategorySlug } = input
  return uniq([
    '/',
    '/rss.xml',
    '/sitemap.xml',
    '/news-sitemap.xml',
    categorySlug && `/${categorySlug}`,
    categorySlug && `/${categorySlug}/rss.xml`,
    previousCategorySlug && `/${previousCategorySlug}`,
    previousCategorySlug && `/${previousCategorySlug}/rss.xml`,
    categorySlug && slug && articlePath(categorySlug, slug, id),
    (previousCategorySlug || categorySlug) &&
      (previousSlug || slug) &&
      articlePath((previousCategorySlug || categorySlug) as string, (previousSlug || slug) as string, id),
  ])
}
