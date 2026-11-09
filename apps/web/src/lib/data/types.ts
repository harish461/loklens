/**
 * Public v1 shapes — transcription of docs/api-contract.md §1 (Shared types) and §2 (Other shapes).
 *
 * OWNER: the backend agent owns this file from now on. The frontend created it as an exact copy of the
 * contract so pages can be built against mocks (src/lib/mock). Change the contract first, then this file.
 *
 * The only addition is `RichTextNode`, which the contract references but does not define (see the note
 * on that type).
 */

export type ImageSize = 'thumb' | 'card' | 'article' | 'og' | 'wide' | 'standard' | 'square'

export interface Image {
  url: string // absolute URL incl. version (?v=…)
  alt: string // Hindi alt text, never empty
  width: number
  height: number
  caption?: string
  credit?: string
  isFallback: boolean // true = site default image (file missing or deleted)
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

// Byline. "LokLens News Team" (no authors set) is { kind: 'organization', name: 'LokLens News Team', slug: null }
export interface AuthorRef {
  kind: 'person' | 'organization'
  name: string
  slug: string | null
  photo?: Image
}
// name = Users.displayName (Hindi) if set, else Users.name

export interface ArticleCard {
  id: number
  title: string
  slug: string
  url: string // canonical path, e.g. "/pradesh/cm-dhami-haldwani-142"
  summary: string
  image: Image // always present; fallback resolved server-side
  category: CategoryRef
  location?: LocationRef
  publishedAt: string
  updatedAt: string
  isBreaking: boolean // already false if breakingUntil has passed
  isTrending: boolean
  isFeatured: boolean
}

export interface Article extends ArticleCard {
  body: RichTextNode[] // Lexical JSON, sanitised (§5)
  tags: TagRef[]
  authors: AuthorRef[] // never empty (organization byline as fallback)
  seo: { title: string; description: string; image: Image; noindex: boolean } // fallbacks resolved
  related: ArticleCard[] // up to 6, same category/tags
}

export interface Paginated<T> {
  items: T[]
  page: number // 1-based
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
}

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null // opaque; null = end
}

export interface ApiError {
  error: { code: 'NOT_FOUND' | 'BAD_REQUEST' | 'SERVER_ERROR'; message: string }
}

// --- §2 Other shapes ------------------------------------------------------------------------------

export interface Home {
  ticker: { title: string; url: string }[] // max 10
  breaking: ArticleCard[] // active breaking, max 5
  featured: ArticleCard[] // hero slider, max 6
  latest: ArticleCard[] // max 12
  sections: { category: CategoryRef; articles: ArticleCard[] }[] // categories with showInNav, 5 each
  videos: Video[] // max 4, may be empty
}

export interface Category extends CategoryRef {
  description?: string
  order: number
  seo: { title: string; description: string } // fallbacks resolved
}

export interface Author extends AuthorRef {
  bio?: string
  social?: { platform: string; url: string }[]
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

export interface EPaper {
  date: string // "2026-11-09", unique
  edition: string
  pdfUrl: string
}

export interface Page {
  title: string
  slug: string
  body: RichTextNode[]
  updatedAt: string
}

export interface SiteSettings {
  name: string
  tagline: string
  logo: Image
  defaultImage: Image
  social: { platform: string; url: string }[]
  contact: { email: string; whatsapp?: string }
  policies: {
    about: string
    contact: string
    privacy: string
    terms: string
    editorial: string
    corrections: string
    disclaimer: string
  } // paths
  navigation: { header: NavItem[]; footer: { title: string; items: NavItem[] }[] }
}
export interface NavItem {
  label: string
  url: string
}

// --- Helper parameters (§2 "listArticles query parameters", "Search") ----------------------------

export interface ListArticlesParams {
  page?: number
  cursor?: string
  pageSize?: number
  category?: string
  tag?: string
  author?: string
  flag?: 'breaking' | 'trending' | 'featured'
}

export interface SearchParams {
  q: string
  page?: number
  pageSize?: number
}

// --- Rich text (§5) -------------------------------------------------------------------------------

/**
 * NOT DEFINED IN THE CONTRACT (gap reported by the frontend). Provisional shape, following Payload's
 * Lexical JSON after read-side resolution:
 * - element nodes: `paragraph`, `heading` (tag h2–h4), `list` (listType bullet|number) / `listitem`,
 *   `quote`, `link` (fields.url, fields.newTab), `linebreak`
 * - `text` with `format` bitmask (1 bold, 2 italic, 8 underline)
 * - `upload` with `value` resolved to `Image`
 * - `block` with `fields.blockType` = 'embed' ({ provider, url }) or 'relatedArticle' ({ article: ArticleCard })
 * Anything else must be skipped by renderers.
 */
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
