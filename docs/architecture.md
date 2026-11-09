# LokLens News — Architecture (Phase 2)

Status: **draft v2 for approval** (revised after QA review). Stack decisions are locked in `CLAUDE.md`;
this document fixes how the pieces fit together. Findings referenced here come from `docs/audit.md`.

---

## 1. System overview

```
             Readers (mobile web, desktop)          Mobile app (later)
                         │                                 │
                         ▼                                 ▼
                ┌──────────────────── Cloudflare (DNS, CDN, WAF, rate limits) ──────────────┐
                │   cache: public pages + /media     bypass: /admin, /api/* (except /api/v1) │
                └──────────────────────────────────┬─────────────────────────────────────────┘
                                                   ▼
                                     VPS  ─  Caddy (HTTPS, compression)
                                                   │
                                     ┌─────────────▼──────────────┐
                                     │  apps/web (Node container) │
                                     │  Next.js App Router        │
                                     │   ├─ (site)  public pages  │◄── data cache tagged per content
                                     │   ├─ (payload) /admin      │
                                     │   ├─ /api/v1  public API   │
                                     │   └─ /api/*   Payload REST │ (admin use; access-controlled)
                                     │  Payload CMS 3 (in-process)│
                                     │  Payload jobs (autoRun)    │ scheduled publish, breaking expiry
                                     └──────┬──────────────┬──────┘
                                            │              │
                                  PostgreSQL 16      Media volume (/media)
                                            │              │
                                            └── nightly backup → off-server storage
```

One deployable app keeps the VPS simple: the public site, the editor admin (`/admin`) and the API for
the mobile app all come from the same Next.js process (Node runtime), sharing Payload's generated types.

### Repository layout

```
apps/web/
  src/app/(site)/          public routes (frontend)
  src/app/(payload)/       Payload admin + REST routes (generated)
  src/app/api/v1/          public API route handlers (backend)
  src/app/legacy/          legacy-URL resolver route handler (seo + backend)
  src/middleware.ts        pattern-only redirects, no DB access (seo)
  src/collections/ src/globals/ src/access/ src/hooks/ src/jobs/   (backend)
  src/lib/data/            typed, cached read helpers — the contract implementation (backend)
  src/lib/richtext/        Lexical → React serializer + sanitising (frontend, rules from contract §5)
  src/lib/seo/             metadata + JSON-LD builders (seo)
  src/components/          UI (frontend)
  src/payload-types.ts     generated types
  src/migrations/          DB migrations (backend)
  scripts/                 seed (backend)
  tests/                   unit, API and Playwright tests (qa)
apps/mobile/               Expo app (Phase 6)
infra/                     docker-compose, Caddyfile, backup scripts, CI (devops)
docs/
```

npm workspaces at the root; Node 22 LTS in containers (local Node 24 is fine for development).
Payload Postgres adapter with `idType: 'serial'` (numeric IDs, used in URLs).

---

## 2. Content model

All content types live in Payload. `*` = required. Text shown to readers is Hindi.

### Articles
| Field | Type | Notes |
|---|---|---|
| title* | text | Hindi headline, ≤ 110 chars recommended |
| slug* | text, unique | Latin transliteration, auto-generated from title, editable |
| summary* | textarea | 1–2 lines; cards, meta description, app previews |
| body* | rich text (Lexical) | allowed nodes per contract §5 |
| featuredImage* | upload → Media | required on publish (≥ 1200px wide); if a file is ever lost, the site default image is used as fallback |
| category* | relation → Categories | one primary category (used in the URL) |
| tags | relation → Tags (many) | |
| location | relation → Locations | district/town; stored now, pages deferred |
| authors | relation → Users (many) | empty = "LokLens News Team" byline (organisation, not a person) |
| publishedAt* | date-time | set on first publish, editable; stored UTC, shown IST |
| isBreaking, isTrending, isFeatured | checkbox | **editor/admin only** (field-level access) |
| breakingUntil | date-time | defaults to publish + 6 h; a job clears `isBreaking` when it passes |
| seo | group | optional overrides: metaTitle, metaDescription, ogImage, noindex |
| _status | draft / published | Payload drafts + versions + scheduled publish; **reporters cannot publish** |

**No content migration:** the new site starts with an empty database (decision 2026-11-09 — no backups of
the old WordPress or PHP sites exist). Editors publish fresh content from launch day.

### Other collections
| Collection | Key fields |
|---|---|
| **Categories** | name (Hindi), slug (validated against reserved route names, §3), description, order, showInNav, color, seo (metaTitle, metaDescription), legacyPath |
| **Tags** | name, slug |
| **Locations** | name (Hindi), slug, district — data only at launch |
| **Users** | email (private), name, displayName (Hindi, used in bylines), slug, role, bio, photo, social links |
| **Media** | file, alt* (Hindi), caption, credit; sizes generated on upload (§5) |
| **Videos** | title, slug, YouTube ID, thumbnail (auto from YouTube if empty), category, publishedAt |
| **EPapers** | date* (**unique**), edition name, PDF* — page thumbnails deferred |
| **Pages** | about, contact, advertise, privacy-policy, terms, editorial-policy, corrections-policy, disclaimer |
| **Redirects** | from (path), to, type (301 / 410) — admin-managed exceptions (§6) |

### Globals
- **SiteSettings** — site name, tagline, logo, default share image, social links, contact email/WhatsApp,
  links to policy pages (needed for Organization schema), analytics ID
- **Navigation** — header menu, footer columns
- **Ticker** — optional manual items for the trending ticker (otherwise built from `isTrending`)

### Categories at launch
| Name | Slug | Old URL |
|---|---|---|
| देश | `desh` | `/desh.php` |
| प्रदेश | `pradesh` | `/pardesh.php` |
| राजनीति | `rajniti` | `/janmanth.php` *(open question — §10)* |
| समाज | `samaj` | `/samaj.php` |
| खेल | `khel` | `/game.php` |
| दुनिया | `duniya` | `/duniya.php` |
| विचार | `vichar` | `/vichar.php` *(on the live site, missing from the brief — §10)* |

---

## 3. URL structure

Clean, lowercase, Latin, no trailing slash, no file extensions. Category slugs are transliterated Hindi
(`pradesh`, `khel`) because they are content; utility routes are English for consistency.

| Page | URL |
|---|---|
| Home | `/` |
| Article | `/{category}/{slug}-{id}` → e.g. `/pradesh/cm-dhami-haldwani-vyapari-samvad-142` |
| Category | `/{category}`, then `/{category}/page/{n}` (n ≥ 2; beyond last page → 404) |
| Tag | `/tag/{slug}`, `/tag/{slug}/page/{n}` |
| Author | `/author/{slug}` |
| Videos | `/video`, `/video/{slug}` |
| E-paper | `/e-paper`, `/e-paper/{yyyy-mm-dd}` |
| Search | `/search?q=…` (noindex, dynamic) |
| Static pages | `/about`, `/contact`, `/advertise`, `/privacy-policy`, `/terms`, `/editorial-policy`, `/corrections-policy`, `/disclaimer` |
| Feeds | `/rss.xml`, `/{category}/rss.xml` |
| Sitemaps | `/sitemap.xml` (single file at this size), `/news-sitemap.xml` (last 48 h) |

**Reserved slugs** — category slugs may not be: `tag, author, video, e-paper, search, about, contact,
advertise, privacy-policy, terms, editorial-policy, corrections-policy, disclaimer, admin, api, legacy,
media, rss.xml, sitemap.xml, news-sitemap.xml, page, _next`. Enforced by validation on Categories.

**Why `slug-id`:** the ID is the lookup key. If an editor changes a slug or category, the old link still
resolves by ID and permanently redirects to the current URL.

**Canonical rules:** `https://loklensnews.com` only; canonicals never include query strings; unknown
IDs/slugs return a real **404**. Empty sections (video, e-paper with no items) render a friendly page with
`noindex` and are left out of the sitemap.

---

## 4. Rendering, caching and publishing

Payload's local API does not go through `fetch`, so caching is explicit: every helper in `src/lib/data` is
wrapped in Next's data cache (`unstable_cache` / `cacheTag`) with these tags:

| Tag | Used by |
|---|---|
| `article:{id}` | article page, API article |
| `list:category:{slug}`, `list:tag:{slug}`, `list:author:{slug}` | listing pages |
| `home` | home page, `/api/v1/home` |
| `feeds` | sitemaps, RSS, news sitemap |
| `settings` | header, footer, settings |

| Page | Strategy |
|---|---|
| Home, listings, articles | static/ISR, time-based `revalidate: 300` as a safety net (also expires breaking labels) + on-demand tags |
| Sitemaps, RSS | route handlers, tag `feeds` |
| Search, `/admin`, preview | dynamic, never cached |

**Publish flow:** editor publishes → Payload `afterChange`/`afterDelete` hook → `revalidateTag()` for the
article, its old and new category, tags, authors, `home`, `feeds` → Cloudflare purge of the same URLs via API.
Hooks skip revalidation when run outside Next (seed scripts) using `req.context.skipRevalidate`.

**Jobs:** Payload jobs queue with `autoRun` (every minute) inside the app container handles scheduled
publishing and breaking-label expiry. No extra service needed.

**Draft preview:** Payload "Preview" button → `/api/preview?secret…&id=` → Next `draftMode()` → article
rendered with drafts, sent with `Cache-Control: private, no-store` (Cloudflare bypasses on the draft cookie).

---

## 5. Media pipeline

- On upload Payload + `sharp` creates WebP sizes: `thumb 320w`, `card 640w`, `article 1200w`, and for
  Google's structured data `og 1200×630`, `wide 1200×675 (16:9)`, `standard 1200×900 (4:3)`,
  `square 1200×1200 (1:1)`. Originals are capped at 2560px.
- **One resize only:** `next/image` uses a custom loader that picks the nearest pre-generated size — the
  Next image optimizer is turned off, so the 2-vCPU server never resizes on request.
- Image URLs carry a version (`?v={updatedAt}`), so Cloudflare can cache `/media/*` for one year safely.
- Alt text is required (Hindi). A missing file falls back to the site default image.
- Storage: Docker volume, backed up nightly; can move to Cloudflare R2 later without changing content.

---

## 6. Redirects (old site)

**Where redirects run**
1. `middleware.ts` — pattern rules only, no database: `www` → apex, strip trailing slash and PATH_INFO
   (`/desh.php/`), fixed maps for the old section/static `.php` pages (below). `/article.php` and unknown
   legacy-looking paths (`/{yyyy}/{mm}/{dd}/…`, `/wp-content/…`, `/feed/`) are **rewritten** to
   `/legacy?path=…`.
2. `/legacy` route handler (Node runtime, can query Payload, cached) → looks up the Redirects collection
   (for any old URL an editor wants to point at a new article) → otherwise returns **410 Gone**.

**Fixed maps:** `/desh.php`→`/desh`, `/pardesh.php`→`/pradesh`, `/janmanth.php`→ *(§10)*, `/samaj.php`→`/samaj`,
`/game.php`→`/khel`, `/duniya.php`→`/duniya`, `/vichar.php`→`/vichar`, `/video.php`→`/video`,
`/epaper.php`→`/e-paper`, `/contact-us.php`→`/contact`, `/advertise.php`→`/advertise`,
`/editorial-policy.php`→`/editorial-policy`, `/terms-and-conditions.php`→`/terms`, `/index.php`,
`/menu.php`, `/random.php`→`/`, `/feed/`→`/rss.xml`.

**Old articles (starting from scratch):** the 126 `article.php?id=N` pages and all old WordPress URLs
return **410 Gone**, which tells Google they were removed on purpose so it drops them quickly. They are
not redirected to the home page, because Google treats mass redirects to home as errors. Section and static
`.php` pages above get proper 301s, which keeps the value of the domain and its category pages.
If editors republish an important old story, they can add its old URL in the Redirects collection.

**Launch SEO steps (Phase 5):** verify the domain in Google Search Console, submit the new sitemaps, apply
to Google News Publisher Center, and watch the 410/404 report for a few weeks.

---

## 7. SEO plan (owned by the seo agent)

- Every page: unique title + description (categories get their own `seo` fields), canonical, Open Graph,
  Twitter card, `lang="hi"`, `og:locale=hi_IN`.
- Article: `NewsArticle` JSON-LD (headline, images in 16:9 / 4:3 / 1:1, datePublished/dateModified with IST
  offset, author → Person or the Organization for "LokLens News Team", publisher logo), `BreadcrumbList`,
  `article:published_time` / `modified_time` meta.
- Site: `Organization` (logo, social profiles, policy URLs from SiteSettings) and `WebSite` with search action.
- `sitemap.xml` + `news-sitemap.xml` (48 h) generated from the database; RSS feeds; `robots.txt` blocks
  `/admin`, `/api`, `/search`, `/legacy`.
- Author pages, about, contact, editorial, corrections, privacy and disclaimer pages for Google News trust.

---

## 8. Security and access

| Role | Can do |
|---|---|
| reporter | create/edit own drafts, upload media; cannot publish or set breaking/trending/featured |
| editor | publish/unpublish any article; manage categories, tags, videos, e-paper; set flags |
| admin | everything, users, settings, redirects |

- **Published-only, enforced in code:** every `src/lib/data` helper calls the local API with
  `overrideAccess: false` and `draft: false`; collection read-access rules return only `_status: published`
  to anonymous users, so the raw `/api/*` REST endpoints are safe too. Users' `email` field has
  `read: admins only`.
- GraphQL is disabled. The admin login is rate-limited by Payload, and a Cloudflare WAF rule challenges bots on
  `/admin` and `/api/users/login`.
- Rich text links allow only `http`, `https`, `mailto` and `tel`; embeds only from allow-listed hosts
  (contract §5).
- Secrets only in `.env` on the server; Postgres is not reachable outside the Docker network.

---

## 9. Environments and delivery

| Environment | Where | Purpose |
|---|---|---|
| local | developer PC: `docker compose up db` + `npm run dev` | building, seeded Hindi sample data |
| staging | same VPS, `staging.loklensnews.com`, own DB, `noindex` + basic auth; can be stopped when idle | QA, editor training, your approvals |
| production | VPS, `loklensnews.com` | live |

Docker images are **built in GitHub Actions** and pushed to GitHub Container Registry; the VPS only pulls
and restarts (no builds on the 4 GB server). CI runs typecheck, lint, tests and build on every pull request;
deploys to staging on merge to `main`; deploys to production on a tagged release after your approval.
Nightly `pg_dump` + media sync off-server, 30-day retention, monthly restore test. Uptime monitoring and
error tracking.

**VPS sizing:** 2 vCPU / 4 GB RAM / 80 GB SSD.

### Deferred (not needed at launch)
Location pages, e-paper page thumbnails, GraphQL, push notifications (Phase 6), split sitemaps.

### Ads (Phase 7, after the new site is live)
Google AdSense is added only after launch (AdSense approval also needs a live site with original
content and the policy pages above). To make that easy later:
- The layout uses an `<AdSlot>` component that renders nothing at launch; later it renders an ad unit with a
  **fixed reserved height**, so ads never push content around (no CLS penalty).
- Planned positions: below the header, inside article body after paragraph 3, sidebar on desktop,
  between listing cards every 6 items.
- `ads.txt` is served from SiteSettings; the consent banner (required for EU/UK visitors) ships with ads.

---

## 10. Decisions and open questions

**Decided (2026-11-09):**
- No backups of old sites exist → start from scratch, no content migration (§2, §6).
- AdSense comes in Phase 7, after the new site is live (§9).

**Still open:**
1. **`janmanth.php`** — is it राजनीति, or Almora district news (जनमंथ)?
2. **विचार (opinion)** — keep it? (assumed **yes**)
3. **Analytics** — Google Analytics 4 (also links with AdSense later), or a privacy-friendly alternative?
4. **Domain/DNS** — who controls the domain registrar and can move DNS to Cloudflare?
