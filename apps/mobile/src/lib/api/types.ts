/**
 * Public API v1 shapes — mirror of docs/api-contract.md §1–§2 (source of truth) and
 * apps/web/src/lib/data/types.ts. Change the contract first, then this file.
 */

export type ImageSize = 'thumb' | 'card' | 'article' | 'og' | 'wide' | 'standard' | 'square'

export interface Image {
  url: string // absolute URL incl. version (?v=…)
  alt: string // Hindi alt text
  width: number
  height: number
  caption?: string
  credit?: string
  isFallback: boolean
  sizes: Partial<Record<ImageSize, { url: string; width: number; height: number }>>
}

export interface CategoryRef {
  id: number
  name: string
  slug: string
  color?: string
}

export interface TagRef {
  id: number
  name: string
  slug: string
}

export interface LocationRef {
  id: number
  name: string
  slug: string
}

/** "LokLens News Team" byline = { kind: 'organization', name: 'LokLens News Team', slug: null } */
export interface AuthorRef {
  kind: 'person' | 'organization'
  name: string
  slug: string | null
  photo?: Image
}

export interface ArticleCard {
  id: number
  title: string
  slug: string
  url: string // site path, e.g. "/desh/some-story-56"
  summary: string
  image: Image
  category: CategoryRef
  location?: LocationRef
  publishedAt: string // ISO 8601 with +05:30
  updatedAt: string
  isBreaking: boolean // already false once breakingUntil has passed
  isTrending: boolean
  isFeatured: boolean
}

export interface RichTextNode {
  type: string
  version?: number
  children?: RichTextNode[]
  text?: string
  format?: number | string
  tag?: string
  listType?: 'bullet' | 'number' | 'check'
  fields?: Record<string, unknown>
  value?: unknown
  [key: string]: unknown
}

export interface Article extends ArticleCard {
  body: RichTextNode[]
  tags: TagRef[]
  authors: AuthorRef[]
  seo: { title: string; description: string; image: Image; noindex: boolean }
  related: ArticleCard[]
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
}

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

export interface ApiErrorBody {
  error: { code: 'NOT_FOUND' | 'BAD_REQUEST' | 'SERVER_ERROR'; message: string }
}

export interface Video {
  id: number
  title: string
  slug: string
  url: string
  youtubeId: string
  thumbnail: Image
  category?: CategoryRef
  publishedAt: string
}

export interface Home {
  ticker: { title: string; url: string }[]
  breaking: ArticleCard[]
  featured: ArticleCard[]
  latest: ArticleCard[]
  sections: { category: CategoryRef; articles: ArticleCard[] }[]
  videos: Video[]
}

export interface Category extends CategoryRef {
  description?: string
  order: number
  seo: { title: string; description: string }
}

export interface NavItem {
  label: string
  url: string
}

export interface SiteSettings {
  name: string
  tagline: string
  logo: Image
  defaultImage: Image
  social: { platform: string; url: string }[]
  contact: { email: string; whatsapp?: string }
  policies: Record<'about' | 'contact' | 'privacy' | 'terms' | 'editorial' | 'corrections' | 'disclaimer', string>
  navigation: { header: NavItem[]; footer: { title: string; items: NavItem[] }[] }
}

export type ArticleFlag = 'breaking' | 'trending' | 'featured'

export interface ListArticlesParams {
  pageSize?: number
  category?: string
  tag?: string
  author?: string
  flag?: ArticleFlag
}

export interface Page {
  title: string
  slug: string
  body: RichTextNode[]
  updatedAt: string
}

/** YouTube Short from the channel's public Shorts feed (GET /api/v1/shorts). */
export interface Short {
  id: string // 11-character YouTube video id
  title: string
  url: string // https://www.youtube.com/shorts/{id}
  thumbnail: { url: string; width: number; height: number } | null
  publishedAt: string
}
