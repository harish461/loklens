# LokLens News: Phase 1 SEO discovery audit

- **Site audited:** https://loklensnews.com/ (live, read-only)
- **Date:** 2026-11-09
- **Method:** I fetched raw HTML and headers with curl for the home page, every category page, every static page and all article IDs 1–145. I checked rendering and resource timing in a browser. I read the Wayback Machine CDX index and its archived pages for the earlier site. I submitted no forms and did not log in.
- **Not available:** Google Search Console, analytics and server logs. Anything that depends on them is marked **not verified**.

---

## Summary

1. **The site has been migrated before, and the old URLs are already broken.** Until at least April 2026, loklensnews.com ran on **WordPress** (All in One SEO v4.9.3) with permalinks like `/2026/04/03/news-136/`. Post numbers went up to at least `news-368`. Those URLs and the old pages (`/contact-us/`, `/editorial-policy/`, `/privacy-policy-2/`, `/disclaimer/`, `/feed/`) now **return 404**. I sampled 6 archived WP posts, and none of their titles exist on the current site. This rebuild must handle **two** generations of legacy URLs.
2. **The current site is a custom PHP site (PHP 8.2, LiteSpeed, Hostinger) with query-string URLs.** Articles are `article.php?id=N`. Categories and static pages are flat `.php` files. Slugs, tags, author pages, search and pagination do not exist.
3. **Content is small.** There are **126 live articles** (IDs 6–140, with gaps), all dated **15 Aug 2026 – 02 Nov 2026**. Every one is credited to "Loklens News Team". 54 of them (the ones re-imported on 15/16 Aug) embed `/wp-content/uploads/...` images that now **404**.
4. **Sitemaps are stale.** `sitemap.xml` was last updated 2026-10-12. It is missing the 12 newest articles (127, 129, 131–140), lists 54 dead image URLs, and includes thin pages (empty video page, "coming soon" e-paper page). `news-sitemap.xml` holds a single URL from 2026-10-11, so the Google News sitemap is effectively empty. There is no RSS feed.
5. **On-page SEO is weak outside articles.** Every category and static page except `janmanth.php` reuses the **home page title and meta description**. The live `duniya.php` H1 is admin placeholder text: "Admin panel se is category ki featured news add karo". Category H1s are the title of the lead article, not the category name.
6. **Structured data is incomplete.** Every page carries `NewsMediaOrganization` + `WebSite` (no SearchAction). Articles have **no `NewsArticle`, `BreadcrumbList` or `Person` schema**, and no `article:published_time` meta. The old WordPress site did have `BlogPosting`, `BreadcrumbList` and `Person`.
7. **Duplicate-content and canonical bugs exist.** `www.` serves a full 200 duplicate with a self-referencing www canonical. The canonical echoes any query string (`?id=138&x=1`). `/desh.php/` returns 200. Unknown article IDs return a **soft 404**: 200 with the home title.
8. **Image weight is the big performance problem.** Pages are server-rendered with almost no JS (TTFB about 110–130 ms, HTML brotli-compressed, HTTP/3). But images are uploaded at full camera size (up to 4160×2767, 1.3–3.2 MB each) and used even as thumbnails. Article pages do not lazy-load images, so article 138 pulls about 6+ MB of images.
9. **E-E-A-T gaps:** no About page (the footer link is `#`), no privacy policy (the footer "गोपनीयता नीति" link points to the editorial policy), no author pages, and no named journalists. An editorial policy page exists and is good.

---

## Page types & URL patterns

The current site uses Latin `.php` filenames with no trailing slash. It has no Hindi slugs and no human-readable article slugs. Article IDs are numeric query parameters.

| Page type | URL pattern | Real examples | Status / notes |
|---|---|---|---|
| Home | `/` (also `/index.php`, `/?anything`) | https://loklensnews.com/ , https://loklensnews.com/index.php | 200. `/index.php` canonicals to `/` (OK). |
| Article | `/article.php?id={int}` | https://loklensnews.com/article.php?id=138 , https://loklensnews.com/article.php?id=6 | 200. Live IDs 6–140; missing: 1–5, 65, 72–75, 109, 118, 128, 130, 141+. Missing IDs return **200 soft-404** with the home title. |
| Category: देश | `/desh.php` | https://loklensnews.com/desh.php | 200. No pagination (`?page=2` returns the same page). |
| Category: प्रदेश | `/pardesh.php` (misspelling of "pradesh") | https://loklensnews.com/pardesh.php | 200. 62 articles, the largest category. |
| Category: राजनीति | `/janmanth.php` | https://loklensnews.com/janmanth.php | 200. The nav label is राजनीति, but the page title is "जनमंथ" and the description says it covers Almora district news. The label and the content don't match. |
| Category: समाज | `/samaj.php` | https://loklensnews.com/samaj.php | 200. Only 1 article. |
| Category: खेल | `/game.php` | https://loklensnews.com/game.php | 200. 9 articles. |
| Category: दुनिया | `/duniya.php` | https://loklensnews.com/duniya.php | 200. 4 articles. **H1 is admin placeholder text.** |
| Category: विचार (opinion) | `/vichar.php` | https://loklensnews.com/vichar.php | 200. 10 articles. Not in `CLAUDE.md`'s category list. |
| Video | `/video.php` | https://loklensnews.com/video.php | 200. **0 videos.** Shows the admin instruction text in Hinglish. |
| E-paper | `/epaper.php` | https://loklensnews.com/epaper.php | 200. "ई-पेपर जल्द आ रहा है" (coming soon). No PDFs. |
| Contact | `/contact-us.php` | https://loklensnews.com/contact-us.php | 200. Email newsloklens@gmail.com. |
| Advertise / submit news | `/advertise.php` | https://loklensnews.com/advertise.php | 200. The form sends via WhatsApp. |
| Editorial policy | `/editorial-policy.php` | https://loklensnews.com/editorial-policy.php | 200. Footer labels it "गोपनीयता नीति" (privacy policy), which is wrong. |
| Terms | `/terms-and-conditions.php` | https://loklensnews.com/terms-and-conditions.php | 200 |
| About | none | footer `href="#"` | **Missing.** `/about.php`, `/about-us.php` → 404. |
| Privacy policy | none | n/a | **Missing.** `/privacy-policy.php`, `/privacy.php` → 404. |
| Menu (mobile) | `/menu.php` | https://loklensnews.com/menu.php | 200, indexable, thin. Uses the home title. |
| Random article | `/random.php` | https://loklensnews.com/random.php | 302 → a random `article.php?id=N`. robots.txt disallows it (OK). |
| Tag / Author / Search / Pagination | none | n/a | Not present (`tag.php`, `author.php`, `search.php` → 404). |
| 404 page | any unknown path | e.g. `/feed/` | Hostinger default 404 page (`lang="en-us"`, not branded). |

### Legacy WordPress URLs (previous site, now 404)

Source: Wayback Machine snapshot from 2026-04-03. That is the only crawl the archive has. The CDX index has no `.php` URLs at all.

| Old pattern | Examples (archived) | Now |
|---|---|---|
| `/{yyyy}/{mm}/{dd}/news-{n}/` | `/2026/01/01/news-35/`, `/2026/04/03/news-136/`, `/2026/04/02/news-368/` | 404 |
| WP pages | `/contact-us/`, `/editorial-policy/`, `/terms-and-conditions/`, `/privacy-policy-2/`, `/disclaimer/`, `/blog/` | 404 |
| Feeds | `/feed/`, `/comments/feed/`, `/sitemap.rss` | 404 |
| WP sitemaps | `/sitemap.xml` (index) → `post-sitemap.xml`, `page-sitemap.xml`, `category-sitemap.xml`, `post_tag-sitemap.xml`, `post_tag-sitemap2.xml`, `addl-sitemap.xml` | Replaced by the PHP sitemap. The child sitemaps were not archived. |
| Category / tag archives | Existed according to the sitemap index (WP category + tag taxonomies); exact paths **not verified** | 404 |
| Media | `/wp-content/uploads/{yyyy}/{mm}/...` | 404 (53 distinct files are still referenced by current articles) |

I matched 6 archived WP posts (news-35, 36, 360, 363, 368, 136) by title against all 126 current articles and found **no match**. Most of the WordPress-era content (at least about 368 post IDs) appears **not to have been carried over**. The 54 articles dated 15/16 Aug 2026 that still use `wp-content` image paths look like a partial re-import. I have **not verified** how many old WP URLs are still indexed or still earn links; that needs Search Console.

### Host and protocol variants

| Variant | Behaviour |
|---|---|
| `http://loklensnews.com/` | 301 → `https://loklensnews.com/` (good) |
| `http://www.loklensnews.com/` | 301 → `https://www.loklensnews.com/` (stays on www) |
| `https://www.loklensnews.com/*` | **200, full duplicate**, and the canonical/og:url point to `www.` |
| Extra query params (`?id=138&x=1`) | 200; the canonical includes the junk param |
| PATH_INFO (`/desh.php/`) | 200 duplicate |
| `/desh` (no extension) | 404 |

---

## Sitemaps / robots / feeds

**robots.txt** (200, text/plain):

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /image_upload.php
Disallow: /image-upload/
Disallow: /includes/
Disallow: /config.php
Disallow: /random.php
Sitemap: https://loklensnews.com/sitemap.xml
Sitemap: https://loklensnews.com/news-sitemap.xml
```

This is fine as it stands. It reveals the admin path, which doesn't matter for SEO.

**sitemap.xml** (200, a single urlset with no index):
- 128 URLs: home, 8 section pages, 5 static pages, and 114 articles.
- Every `lastmod` is between 2026-08-16 and 2026-10-12. The file looks static or stale, because it is missing the 12 live articles published after 12 Oct (127, 129, 131–140).
- It includes `video.php` (empty) and `epaper.php` (coming soon), which are thin pages.
- There are 114 `<image:loc>` entries, and **54 of them point to 404 `wp-content` images**.
- It uses `changefreq` and `priority`, which Google ignores. That is harmless.

**news-sitemap.xml** (200): holds **1 URL** (`article.php?id=126`, publication_date `2026-10-11T00:00:00+00:00`, time zeroed). It is stale and outside the 48-hour window, so it currently gives Google News nothing.

**Other probes:** `/sitemap_index.xml`, `/sitemap-news.xml`, `/feed`, `/feed/`, `/rss`, `/rss.xml` and `/feed.xml` all return 404. There is **no RSS/Atom feed** and no `<link rel="alternate" type="application/rss+xml">`. The WordPress `/feed/` the site used to have is gone.

---

## On-page SEO

All pages return `lang="hi"`, `meta robots: index, follow, max-image-preview:large`, OG and Twitter cards, and `og:locale=hi_IN`. No page has hreflang (fine for a single-language site). No page has a favicon `<link>`, and `/favicon.ico` → 404. The content is **server-rendered**: the raw HTML (curl) contains the full article text, headings and links. There are no external JS files and only 1–3 small inline scripts. The rendered DOM matches the raw HTML.

### Home (`/`)

| Item | Finding |
|---|---|
| Title | "LokLens News – Uttarakhand News Today \| Uttarakhand Live News in Hindi" (70 chars, English) |
| Meta description | Romanised Hinglish: "LokLens News par padhiye Uttarakhand ki taaza khabaren live — Dehradun, Haridwar…". There is no Devanagari version. |
| Canonical | `https://loklensnews.com/` (but on www it is the www version) |
| OG / Twitter | Present. og:image is the current lead story's image (1280×576). `summary_large_image`. |
| JSON-LD | `NewsMediaOrganization` + `WebSite` (no `SearchAction`, no `sameAs`, no logo dimensions). An `ItemList` of 6 latest articles uses **relative URLs** (`article.php?id=140`), which is invalid for structured data. |
| Headings | One H1 (an English keyword string), H2 per slider story, H3 "लेटेस्ट खबरें", H4 per article. Heading levels are presentational. |
| Images | 11, all with alt text. 9 use `loading="lazy"`. No width/height attributes. 1 slider image is a 404 `wp-content` file. |
| Links | "हमारे बारे में" → `#`. "और देखें" → `#`. Footer "गोपनीयता नीति" → editorial-policy.php. |
| Language mix | The UI is Devanagari, but relative dates are Hinglish ("7 din pehle"). The trending ticker has a typo ("रामखेत" for रानीखेत). |

### Article (`/article.php?id=138`)

| Item | Finding |
|---|---|
| Title | The article headline only, with no brand suffix. |
| Meta description | The first about 160 characters of the summary (Devanagari), truncated with "…". |
| Canonical | Self, but it echoes extra query params and the www host. |
| OG / Twitter | `og:type=article` and og:image (the original upload, 4160×2767). **No** `article:published_time`, `article:modified_time`, `article:section` or `article:author`. |
| JSON-LD | Only the site-wide Organization + WebSite. **No `NewsArticle`, `BreadcrumbList` or `Person`.** |
| Headings | One H1 (the headline). H3 "तस्वीरें" and "संबंधित खबरें". Related titles are H5. |
| Byline / date | "Loklens News Team" (no link). The date is shown as "28 Oct 2026" with no time and no updated date. |
| Breadcrumb | Visible (होम › प्रदेश) but not marked up. |
| Images | 7, all with alt text (= headline). **No lazy loading** and no width/height. Full-resolution originals are used for related thumbnails. |
| Body | The median article is about 580 words of page text (including chrome). Body text is server-rendered. |
| Share | WhatsApp, Facebook and Twitter share links. |

### Category (`/pardesh.php`, same template for all sections)

| Item | Finding |
|---|---|
| Title | **Same as home** on desh, pardesh, samaj, game, duniya, vichar, video, epaper, menu, contact, advertise, editorial-policy and terms. Only `janmanth.php` has its own title ("जनमंथ"). |
| Meta description | **Same generic Hinglish description** everywhere except janmanth. |
| Canonical | Self (`/pardesh.php`). `?page=2` gets a self canonical but shows identical content. |
| OG | og:image = logo.png (1024×1024 square, not the large-image ratio). |
| H1 | The **headline of the featured article**, not the category name. On `duniya.php` it is the placeholder text "Admin panel se is category ki featured news add karo". |
| Pagination | **None.** Each category shows only about 9 recent items, so older articles are reachable only through the sitemap and related links. |
| Images | Alt present. **No lazy loading.** The lead image on pardesh is a 404 `wp-content` file. |

---

## Structured data

| Schema | Present? | Notes / missing vs requirements |
|---|---|---|
| `NewsMediaOrganization` | Yes (all pages) | Missing: `sameAs` (FB / Instagram / YouTube exist), `logo` width/height (logo is 1024×1024 PNG, 87 KB), `publishingPrinciples` (→ editorial policy), `ethicsPolicy`, `correctionsPolicy`, `contactPoint`, `address`. |
| `WebSite` | Yes | `inLanguage: hi`. **No `potentialAction` SearchAction** (the site has no search). |
| `ItemList` (home) | Yes | Item URLs are relative, so they are invalid. Low value. |
| `NewsArticle` | **No** | Required or recommended fields to add: `headline`, `image` (≥1200 px wide, several ratios), `datePublished` and `dateModified` with time + IST offset, `author` (`Person` with `url`), `publisher` (→ org @id), `mainEntityOfPage`, `articleSection`, `inLanguage`. |
| `BreadcrumbList` | **No** (a visible breadcrumb exists) | Add for article and category pages. |
| `Person` / author | **No** | No author entities at all. |
| `VideoObject` | No | No videos on the site yet. |

Google's Rich Results Test was **not run** because it needs an interactive Google tool. My findings come from reading the JSON-LD in the raw HTML.

---

## Performance

I measured from a desktop browser and curl, so these are not field CWV data. CrUX and PageSpeed Insights field data are **not verified**.

| Signal | Home | Article (id=138) |
|---|---|---|
| TTFB | about 110 ms | about 130 ms |
| HTML size | 40 KB (14 KB brotli) | 30 KB |
| HTML caching | no `Cache-Control` | same |
| External JS | 0 files (3 inline scripts) | 0 files (1 inline) |
| CSS | inline `<style>` (about 8 KB) + Google Fonts CSS | same |
| Fonts | Google Fonts: Noto Sans Devanagari **and** Inter, 5 weights each (400–800), `display=swap`. About 190 KB of woff2 on first view. | same |
| DOM size | small | about 200 nodes |
| Images | JPEG/PNG only. **No WebP/AVIF, no `srcset`/`sizes`, no width/height** (CLS risk). | Same, plus **no lazy loading** on article/category templates. |
| Image weight | Logo 87 KB PNG at 1024×1024, shown at 48 px. Hero 104 KB. | Hero 4160×2767 = **1.3 MB**. Related thumbs 1.8 MB, 3.2 MB… The page totals about **6+ MB**. |
| Image sample (12 of 72 `/assets/images/` files) | min 87 KB, median about 231 KB, max 444 KB | the upload sizes above |
| Static asset caching | `Cache-Control: public, max-age=604800` (7 days) on images | — |
| Transport | HTTP/3, brotli. No CDN in front (served directly by LiteSpeed on Hostinger). | — |

**Main CWV risks on mobile:** LCP from multi-MB hero images, CLS from images without dimensions, and font load from 10 font files across two families.

---

## Content inventory

| Metric | Value |
|---|---|
| Live articles | **126** (IDs 6–140; 19 IDs missing/deleted in 1–145) |
| Articles in sitemap | 114 (12 newest missing) |
| Date range | Oldest **15 Aug 2026** (IDs 6–8; the batch re-imported from WordPress). Newest 02 Nov 2026 (ID 140). |
| Publishing rate | Aug 2026: 63 (mostly the import), Sep: 41, Oct: 21, Nov (to 9th): 1. The rate is declining. |
| By category (from the article page label) | प्रदेश 62, देश 29, राजनीति 11, विचार 10, खेल 9, दुनिया 4, समाज 1 |
| Authors | 1 ("Loklens News Team") on all 126 |
| Tags | none |
| Videos | 0 |
| E-paper editions | 0 |
| Articles with broken (`wp-content`) images | 54 (53 distinct files, all 404) |
| Titles with heavy English/Latin script | About 6 (e.g. id 39 "Strait of Hormuz Blockade: …", id 99 "PB Fintech Share Crash: …"). Hinglish headline style is in use. |
| Previous WordPress content | At least about 368 post IDs (Jan–Apr 2026 seen in the archive). Apparently **not** migrated. The full list is **not verified**: the archived post sitemaps are not available. |

---

## E-E-A-T

| Item | Status |
|---|---|
| About page (हमारे बारे में) | **Missing.** The footer link is `#`. |
| Contact page | Present. Gmail address only. No physical address, phone number or named editor. |
| Editorial policy | Present and detailed (10 sections incl. corrections, election coverage, ads-vs-news). Effective 30 Nov 2025. |
| Corrections policy | Only as section 9 of the editorial policy. There is no standalone page. |
| Privacy policy | **Missing.** The footer "गोपनीयता नीति" label points to the editorial policy. The old WP site had `/privacy-policy-2/`. |
| Terms | Present. |
| Ownership / funding / masthead | Not found. The footer credits "Developed by Orionsadvertising.com". |
| Author pages / bylines | None. Every article is "Loklens News Team". |
| Disclaimer | The old WP site had `/disclaimer/`. The current site does not. |
| Social profiles | Facebook, Instagram and YouTube are linked in the footer (one footer social link is `#`). They are not in `sameAs`. |
| Google News Publisher Center status | **Not verified.** |

---

## Redirect requirements for the rebuild

The new site needs 301s for **both** legacy generations. Proposed new URL scheme (to confirm with the architect): `/{category-slug}/{article-slug}-{id}` or `/{category-slug}/{article-slug}`. Either way, the article's numeric ID must be stored so the redirect can be derived.

| Old URL | New target | Method |
|---|---|---|
| `/article.php?id={N}` (126 live IDs) | New article URL | **Must match on the query string.** Store `legacyId` on each migrated article and resolve it at the edge or in middleware with a 301. Deleted IDs → 410 (or 301 to the category if known). |
| `/index.php` | `/` | 301 |
| `/desh.php` | `/desh` (or the chosen slug) | 301 |
| `/pardesh.php` | `/pradesh` (fixes the spelling) | 301 |
| `/janmanth.php` | `/rajniti` **or** a separate `/almora` / `/janmanth` section. **Editorial decision needed.** | 301 |
| `/samaj.php`, `/game.php`, `/duniya.php`, `/vichar.php` | `/samaj`, `/khel`, `/duniya`, `/vichar` | 301 |
| `/video.php`, `/epaper.php` | `/video`, `/epaper` | 301 |
| `/contact-us.php`, `/advertise.php`, `/editorial-policy.php`, `/terms-and-conditions.php` | `/contact`, `/advertise`, `/editorial-policy`, `/terms` | 301 |
| `/menu.php` | `/` | 301 |
| `/random.php` | keep as a random redirect, or drop (→ `/`) | 302/301 |
| `/{yyyy}/{mm}/{dd}/news-{n}/` (old WP posts) | The matching new article if the content exists, else the category or home (or 410) | **Blocked:** we have no mapping from WP post IDs to current `article.php` IDs, and those posts appear not to exist on the current site. We need the **old WordPress database/export** or a Search Console export of indexed and linked URLs. |
| `/contact-us/`, `/editorial-policy/`, `/terms-and-conditions/`, `/privacy-policy-2/`, `/disclaimer/`, `/blog/` | New static pages | 301 |
| `/feed/`, `/comments/feed/`, `/sitemap.rss` | New RSS feed URL | 301 |
| WP category/tag archives (`/category/...`, `/tag/...`) | New category pages / tag pages | Pattern 301. Exact old slugs are **not verified**. |
| `/wp-content/uploads/...` images | Re-hosted media (if the originals can be recovered), else leave as 404 | Needs the WP uploads folder from the old host or a backup. |
| `https://www.loklensnews.com/*` | `https://loklensnews.com/*` | 301 at Cloudflare/proxy. This duplicate already exists today. |
| Any `?…` junk params / PATH_INFO | Canonical clean URL | Canonicals must be built from data, never from `REQUEST_URI`. |

**Blocking items for the redirect plan**

1. **Old WordPress data.** Is there a WP database/XML export or an uploads backup? Without it, the about 300+ WP URLs cannot be mapped to content, and the 54 articles' images can't be restored.
2. **Search Console access** (property for loklensnews.com, domain property preferred). I need the indexed-pages and top-linked-pages exports to decide which legacy URLs matter.
3. **Current DB export** (articles with `id`, title, category, date, image paths), so `legacyId` can be kept during migration.
4. **Editorial decision:** is `janmanth` राजनीति or an Almora/district section? Is विचार a category? Should `pardesh` be renamed?

---

## Recommendations for the new site (prioritised)

**P0: must-have at launch (ranking protection)**
1. Build the 301 map above. Keep `legacyId` on every article and support `article.php?id=` lookups permanently. Get the WP export and GSC data before launch.
2. Use one canonical host (`https://loklensnews.com`), with 301s from www and http at Cloudflare. Build canonicals from content data. Return a real 404 or 410 (not 200) for unknown IDs and paths.
3. Generate sitemaps dynamically: a sitemap index plus article sitemaps chunked by month, a category/static sitemap, and a **Google News sitemap** covering the last 48 h with full ISO timestamps (+05:30). Exclude thin or empty pages.
4. Add `NewsArticle` JSON-LD on every article (headline, ≥1200 px images in 16:9 / 4:3 / 1:1, datePublished/dateModified with time, author Person with URL, publisher). Add `BreadcrumbList` on articles and categories. Add `Organization` with `sameAs`, logo dimensions and policy URLs.
5. Give every page a unique Devanagari-first title and description. Use the category name as the H1 on category pages, with paginated archives (`/pradesh/page/2`) that are crawlable and self-canonical.
6. Run an image pipeline: resize on upload, serve WebP/AVIF through `next/image` with `srcset`/`sizes`, set width/height, lazy-load below the fold, and use `priority` only for the LCP hero. Store a 1200 px+ OG/Schema variant.

**P1: soon after launch**
7. Add an RSS feed (`/feed` plus per-category feeds) with `<link rel="alternate">`. 301 the old `/feed/` to it.
8. Publish E-E-A-T pages: About (ownership, team, location), Privacy Policy, Corrections Policy, Disclaimer, and a masthead/contact with a physical address. Add author profiles (`/author/{slug}`) with bio and photo. Link each policy from the Organization schema and the footer.
9. Add on-site search (`/search?q=`) and a `WebSite` SearchAction.
10. Fonts: self-host via `next/font`. Load Noto Sans Devanagari in 2–3 weights, subset it, and drop Inter or reduce it to one weight.
11. Put HTML behind Cloudflare with ISR plus short edge caching (e.g. `s-maxage=60, stale-while-revalidate`).

**P2: growth**
12. Keyword strategy: use Devanagari titles and slugs-as-transliteration (Latin slugs are recommended for shareability, e.g. `/pradesh/gairsain-cm-dhami-yojana-lokarpan`). Target both "उत्तराखंड न्यूज़" and "Uttarakhand news today". Add district hubs (Almora, Ranikhet, Pithoragarh, Nainital, Dehradun), which match the actual coverage concentration.
13. Add tags and topic pages, with editorial controls so thin tag pages are `noindex`.
14. Only add `VideoObject` (video) and an e-paper archive once there is real content. Until then keep them out of nav and sitemaps, or `noindex` them.
15. Clean up the UI copy: no Hinglish admin placeholders on public pages, Hindi relative dates ("7 दिन पहले"), and fix the ticker typos.
