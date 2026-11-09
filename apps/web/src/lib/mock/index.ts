/**
 * Mock implementations of the web data helpers (docs/api-contract.md §2), same names and signatures as
 * the future `src/lib/data`. Swapping to real data is an import change: `@/lib/mock` → `@/lib/data`.
 *
 * Not-found convention used here (and requested from the backend): single-item helpers resolve to
 * `null` when the item doesn't exist or isn't published; pages call `notFound()`.
 */
import type {
  Article,
  ArticleCard,
  Author,
  Category,
  CursorPage,
  EPaper,
  Home,
  ListArticlesParams,
  Page,
  Paginated,
  SearchParams,
  SiteSettings,
  TagRef,
  Video,
} from '@/lib/data/types'

import { articles, authors, categories, ePapers, pages, siteSettings, tags, toCard, videos } from './fixtures'

const sorted = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id)

function paginate<T>(all: T[], page = 1, pageSize = 20): Paginated<T> {
  const size = Math.min(Math.max(pageSize, 1), 50)
  const totalPages = Math.max(1, Math.ceil(all.length / size))
  return {
    items: all.slice((page - 1) * size, page * size),
    page,
    pageSize: size,
    totalItems: all.length,
    totalPages,
    hasNextPage: page < totalPages,
  }
}

function filterArticles(params: ListArticlesParams): Article[] {
  return sorted.filter(
    (a) =>
      (!params.category || a.category.slug === params.category) &&
      (!params.tag || a.tags.some((t) => t.slug === params.tag)) &&
      (!params.author || a.authors.some((x) => x.slug === params.author)) &&
      (!params.flag ||
        (params.flag === 'breaking' && a.isBreaking) ||
        (params.flag === 'trending' && a.isTrending) ||
        (params.flag === 'featured' && a.isFeatured)),
  )
}

export async function getHome(): Promise<Home> {
  const cards = sorted.map(toCard)
  const featured = cards.filter((a) => a.isFeatured).slice(0, 6)
  return {
    ticker: cards
      .filter((a) => a.isTrending)
      .slice(0, 10)
      .map((a) => ({ title: a.title, url: a.url })),
    breaking: cards.filter((a) => a.isBreaking).slice(0, 5),
    featured,
    latest: cards.filter((a) => !featured.includes(a)).slice(0, 12),
    sections: [...categories]
      .sort((a, b) => a.order - b.order)
      .map((c) => ({
        category: { id: c.id, name: c.name, slug: c.slug },
        articles: cards.filter((a) => a.category.id === c.id).slice(0, 5),
      }))
      .filter((s) => s.articles.length > 0),
    videos: videos.slice(0, 4),
  }
}

export async function listArticles(params: ListArticlesParams & { cursor: string }): Promise<CursorPage<ArticleCard>>
export async function listArticles(params?: ListArticlesParams): Promise<Paginated<ArticleCard>>
export async function listArticles(
  params: ListArticlesParams = {},
): Promise<Paginated<ArticleCard> | CursorPage<ArticleCard>> {
  const all = filterArticles(params).map(toCard)
  if (params.cursor !== undefined) {
    const start = params.cursor ? Number(params.cursor) : 0
    const size = params.pageSize ?? 20
    const items = all.slice(start, start + size)
    return { items, nextCursor: start + size < all.length ? String(start + size) : null }
  }
  return paginate(all, params.page, params.pageSize)
}

export async function getArticle(id: number): Promise<Article | null> {
  return articles.find((a) => a.id === id) ?? null
}

export async function listCategories(): Promise<Category[]> {
  return [...categories].sort((a, b) => a.order - b.order)
}

export async function getCategory(slug: string): Promise<Category | null> {
  return categories.find((c) => c.slug === slug) ?? null
}

export async function getTag(slug: string): Promise<TagRef | null> {
  return tags.find((t) => t.slug === slug) ?? null
}

export async function getAuthor(slug: string): Promise<Author | null> {
  return authors.find((a) => a.slug === slug) ?? null
}

export async function listVideos(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<Video>> {
  return paginate(videos, params.page, params.pageSize)
}

export async function getVideo(slug: string): Promise<Video | null> {
  return videos.find((v) => v.slug === slug) ?? null
}

// Newest first. Set MOCK_EMPTY_EPAPER=1 to preview the empty state.
const ePapersSorted = () =>
  process.env.MOCK_EMPTY_EPAPER === '1' ? [] : [...ePapers].sort((a, b) => b.date.localeCompare(a.date))

export async function listEPapers(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<EPaper>> {
  return paginate(ePapersSorted(), params.page, params.pageSize)
}

export async function getEPaper(date: string): Promise<EPaper | null> {
  return ePapersSorted().find((e) => e.date === date) ?? null
}

export async function getPage(slug: string): Promise<Page | null> {
  return pages.find((p) => p.slug === slug) ?? null
}

export async function search(params: SearchParams): Promise<Paginated<ArticleCard>> {
  const q = params.q.normalize('NFC').trim().toLowerCase()
  if (q.length < 2 || q.length > 100) return paginate<ArticleCard>([], 1, params.pageSize)
  const hits = sorted.filter((a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q))
  return paginate(hits.map(toCard), params.page, params.pageSize)
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return siteSettings
}
