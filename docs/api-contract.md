# LokLens News — API Contract (v1)

Status: **draft v2 for approval** (revised after QA review). Source of truth between backend, frontend and
mobile (see `CLAUDE.md`). Change this file first, then the code. Breaking changes need `/api/v2`.

## Principles

- **Payload's raw REST (`/api/{collection}`) is for the admin panel.** It is access-controlled (anonymous
  users see published content only, never emails) but its shape follows the database and may change, so
  web and mobile must not depend on it. GraphQL is disabled.
- **Public consumers use the v1 shapes below:**
  - **Web** calls the typed helpers in `apps/web/src/lib/data/*` (server-side, Payload local API, no HTTP).
  - **Mobile** calls `GET /api/v1/*`, which returns exactly the same shapes from the same helpers.
    **Deferred to Phase 6** (decision 2026-11-09: website first) — until then only the web helpers are built.
- Helpers always query with `overrideAccess: false, draft: false` → **published content only**.
  Draft preview uses separate helpers that are only reachable in Next `draftMode`.
- Dates: stored UTC, **serialised as ISO 8601 with IST offset** (`2026-11-09T15:30:00+05:30`) by one shared
  serializer.
- Text fields are Hindi as entered; slugs are Latin. Strings are Unicode NFC-normalised on save.

---

## 1. Shared types

```ts
type ImageSize = 'thumb' | 'card' | 'article' | 'og' | 'wide' | 'standard' | 'square'

interface Image {
  url: string                   // absolute URL incl. version (?v=…)
  alt: string                   // Hindi alt text, never empty
  width: number
  height: number
  caption?: string
  credit?: string
  isFallback: boolean           // true = site default image (file missing or deleted)
  sizes: Partial<Record<ImageSize, { url: string; width: number; height: number }>>
}

interface CategoryRef { id: number; name: string; slug: string; color?: string }
interface TagRef      { id: number; name: string; slug: string }
interface LocationRef { id: number; name: string; slug: string }

// Byline. "LokLens News Team" (no authors set) is { kind: 'organization', name: 'LokLens News Team', slug: null }
interface AuthorRef   { kind: 'person' | 'organization'; name: string; slug: string | null; photo?: Image }
// name = Users.displayName (Hindi) if set, else Users.name

interface ArticleCard {
  id: number
  title: string
  slug: string
  url: string                   // canonical path, e.g. "/pradesh/cm-dhami-haldwani-142"
  summary: string
  image: Image                  // always present; fallback resolved server-side
  category: CategoryRef
  location?: LocationRef
  publishedAt: string
  updatedAt: string
  isBreaking: boolean           // already false if breakingUntil has passed
  isTrending: boolean
  isFeatured: boolean
}

interface Article extends ArticleCard {
  body: RichTextNode[]          // Lexical JSON, sanitised (§5)
  tags: TagRef[]
  authors: AuthorRef[]          // never empty (organization byline as fallback)
  seo: { title: string; description: string; image: Image; noindex: boolean }  // fallbacks resolved
  related: ArticleCard[]        // up to 6, same category/tags
}

interface Paginated<T> {
  items: T[]
  page: number                  // 1-based
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
}

interface CursorPage<T> {
  items: T[]
  nextCursor: string | null     // opaque; null = end
}

interface ApiError { error: { code: 'NOT_FOUND' | 'BAD_REQUEST' | 'SERVER_ERROR'; message: string } }
```

## 2. Endpoints (mobile HTTP) and helpers (web)

| HTTP (mobile) | Web helper | Returns |
|---|---|---|
| `GET /api/v1/home` | `getHome()` | `Home` |
| `GET /api/v1/articles` | `listArticles(params)` | `Paginated<ArticleCard>` or `CursorPage<ArticleCard>` |
| `GET /api/v1/articles/{id}` | `getArticle(id)` | `Article` |
| `GET /api/v1/categories` | `listCategories()` | `Category[]` |
| `GET /api/v1/categories/{slug}` | `getCategory(slug)` | `Category` |
| `GET /api/v1/tags/{slug}` | `getTag(slug)` | `TagRef` |
| `GET /api/v1/authors/{slug}` | `getAuthor(slug)` | `Author` |
| `GET /api/v1/videos` | `listVideos(params)` | `Paginated<Video>` |
| `GET /api/v1/videos/{slug}` | `getVideo(slug)` | `Video` |
| `GET /api/v1/epapers` | `listEPapers(params)` | `Paginated<EPaper>` |
| `GET /api/v1/epapers/{date}` | `getEPaper(date)` | `EPaper` |
| `GET /api/v1/pages/{slug}` | `getPage(slug)` | `Page` |
| `GET /api/v1/search?q=` | `search(params)` | `Paginated<ArticleCard>` |
| `GET /api/v1/settings` | `getSiteSettings()` | `SiteSettings` |
| — (web only) | `listSitemapEntries()` | `{ url: string; updatedAt: string; type: 'article' \| 'category' \| 'tag' \| 'author' \| 'page' \| 'video' \| 'epaper' }[]` |
| — (web only) | `listRecentForNews(hours = 48)` | `ArticleCard[]` (news sitemap) |
| — (web only) | `listForFeed(category?)` | `ArticleCard[]` (RSS, latest 50) |

Deferred to later versions: locations endpoints, `POST /api/v1/devices` (push, Phase 6).

### `listArticles` / `GET /api/v1/articles` query parameters
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int ≥ 1 | 1 | page mode (web listings) |
| `cursor` | string | — | cursor mode (app infinite scroll); **cannot be combined with `page`** → 400 |
| `pageSize` | int 1–50 | 20 | |
| `category` | slug | — | |
| `tag` | slug | — | |
| `author` | slug | — | |
| `flag` | `breaking` \| `trending` \| `featured` | — | |

Sort: `publishedAt` desc, then `id` desc. The cursor encodes `(publishedAt, id)` of the last item, so items
with equal timestamps are never duplicated or skipped. Response is `CursorPage` when `cursor` is sent
(first app request sends `cursor=` empty), otherwise `Paginated`. Page beyond the last → empty `items`
(API) / 404 (web listing page).

### Search
`q` 2–100 chars, NFC-normalised, matched with case-insensitive `ILIKE` on title and summary (enough at this
size; upgrade to Postgres full-text later if needed). Same pagination as above.

### Other shapes

```ts
interface Home {
  ticker: { title: string; url: string }[]          // max 10
  breaking: ArticleCard[]                           // active breaking, max 5
  featured: ArticleCard[]                           // hero slider, max 6
  latest: ArticleCard[]                             // max 12
  sections: { category: CategoryRef; articles: ArticleCard[] }[]  // categories with showInNav, 5 each
  videos: Video[]                                   // max 4, may be empty
}

interface Category extends CategoryRef {
  description?: string; order: number
  seo: { title: string; description: string }       // fallbacks resolved
}

interface Author extends AuthorRef { bio?: string; social?: { platform: string; url: string }[] }

interface Video {
  id: number; title: string; slug: string; url: string
  youtubeId: string; thumbnail: Image; category?: CategoryRef; publishedAt: string
}

interface EPaper {
  date: string                  // "2026-11-09", unique
  edition: string
  pdfUrl: string
}

interface Page { title: string; slug: string; body: RichTextNode[]; updatedAt: string }

interface SiteSettings {
  name: string; tagline: string; logo: Image; defaultImage: Image
  social: { platform: string; url: string }[]
  contact: { email: string; whatsapp?: string }
  policies: { about: string; contact: string; privacy: string; terms: string; editorial: string; corrections: string; disclaimer: string }  // paths
  navigation: { header: NavItem[]; footer: { title: string; items: NavItem[] }[] }
}
interface NavItem { label: string; url: string }
```

## 3. Status codes, caching, limits (HTTP)

| Case | Status | Body |
|---|---|---|
| Found | 200 | the shape |
| Unknown id/slug, or unpublished | 404 | `ApiError` |
| Bad query | 400 | `ApiError` |
| Rate limited | 429 | sent by **Cloudflare** rate-limiting rules (app does not count requests) |

`Cache-Control: public, s-maxage=60, stale-while-revalidate=300` on v1 GETs; search `s-maxage=30`.
Publishing purges affected URLs (architecture §4). CORS: v1 GETs allow any origin (read-only, public data).

## 4. Article URL resolution (web)

`/{category}/{slug}-{id}` → parse trailing `-{id}` → `getArticle(id)`:
- not found / unpublished → 404
- found but path ≠ `article.url` → permanent redirect (308 via `permanentRedirect()`; Google treats it
  like 301) to `article.url`
- found and matches → render

Legacy URLs (`/article.php?id=N` etc.) are handled by the `/legacy` resolver: 301 if an editor added a Redirect, otherwise 410 Gone
(architecture §6).

## 5. Rich text

`body` is Lexical JSON. Allowed nodes: paragraph, heading (h2–h4), list, quote, link, bold/italic/underline,
upload (image → resolved to `Image`), embed, and `relatedArticle` (→ `ArticleCard`).

**Sanitising (server-side on save and again on read):**
- Link URLs: only `http:`, `https:`, `mailto:`, `tel:`; anything else is dropped (text kept). External links
  get `rel="noopener"`.
- Embeds: `{ provider: 'youtube' | 'x' | 'instagram' | 'facebook'; url: string }`; host must match the
  provider's allow-list or the node is removed. Web renders them as **click-to-load facades** (thumbnail +
  button) so third-party scripts never load on page open.
- No raw HTML nodes.

Web renders with `src/lib/richtext`; the app will render the same node list natively. Unknown nodes are
skipped, never crash the renderer.

## 6. Change log

| Version | Date | Change |
|---|---|---|
| v1 draft | 2026-11-09 | Initial contract |
| v1 draft 2 | 2026-11-09 | QA fixes: published-only enforcement, IST serializer, fallback images, cursor pagination, byline rule, sanitising, extra web helpers, Cloudflare rate limits, deferred locations/devices |
| v1 draft 3 | 2026-11-09 | No content migration: legacy URLs return 410 unless an editor adds a Redirect |
