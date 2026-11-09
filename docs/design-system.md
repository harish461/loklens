# LokLens News — Design System v1.1 (approved 2026-11-09; brand colour changed to logo red)

Visual source: design canvas "LokLens News Redesign" (https://claude.ai/artifact/DW7yfyPu2KtbzwZVoJYFYm) —
style guide, Home (mobile + desktop), Category (mobile), Article (mobile). Frontend implements from this file;
the canvas shows the intended look.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--color-brand` | `#C41D17` (logo red, sampled from the logo) | header bar, links, active nav, category labels, primary buttons |
| `--color-brand-dark` | `#9E1611` | hover/pressed |
| `--color-breaking-bg` | `#FFD60A` | **only** the ब्रेकिंग badge (text `--color-ink`) — yellow so it stands out on a red brand |
| `--color-live` | `#C41D17` | pulsing लाइव dot (with `prefers-reduced-motion`: no pulse) |
| `--color-ink` | `#16181D` | headlines, body text, desktop nav underline |
| `--color-text-2` | `#3D434D` | summaries, footer links |
| `--color-muted` | `#5B6270` | meta (time, byline), captions |
| `--color-placeholder` | `#8A909A` | empty-state text only (not for body copy) |
| `--color-surface` | `#F5F6F4` | section separators (8 px bands), footer, category header |
| `--color-border` | `#E3E5E1` | dividers, chip borders |
| `--color-highlight` | `#FFF4D6` | trending/breaking ticker band |
| `--color-whatsapp` | `#1F8F4E` | WhatsApp share button and channel banner (`#EAF5EE` background) |
| `--radius` | `8px` | cards, images, buttons; chips `999px`; badges `4px` |
| spacing | 4 px base, 8 px grid; page gutter 16 px mobile, 24 px desktop | |
| container | `max-width: 1200px` | |

## Typography — Mukta (Google Fonts via `next/font`, subsets `devanagari` + `latin`, weights 400/500/600/700/800)

| Role | Mobile size/line | Desktop | Weight |
|---|---|---|---|
| Hero headline | 24/33 | 34/44 | 800 |
| Article H1 | 26/36 | 34/46 | 800 |
| Section title (h2) | 20/28 | 20–22 | 800 |
| Card title (large) | 18/27 | 20/29 | 700 |
| Card title (list) | 16/24 | 16/24 | 700 (600 for plain link lists) |
| Article body | 18/32 | 19/34 | 400 — max 680 px measure |
| Summary / dek | 16–17/26–27 | 18/28 | 400, `--color-text-2` |
| Meta | 12–14/20 | 13–14 | 500, `--color-muted` |

## Components

- **Header (mobile):** logo + date left; search and menu icon buttons (44 px) right. Category bar below,
  horizontally scrollable, active item = brand colour + 3 px underline.
- **Header (desktop):** logo + tagline/date, search field right; category bar with 2 px ink bottom border,
  active item = brand background with white text.
- **Ticker band:** highlight background, "ट्रेंडिंग" label or yellow "ब्रेकिंग" badge, one line, ellipsis.
- **Breaking strip (mobile):** yellow ब्रेकिंग badge + headline, below the ticker.
- **Hero card:** 16:9 image, category label, hero headline, summary, meta.
- **List card:** text left (category, title, time), 4:3 thumbnail right (104×78 mobile). Category pages put
  the thumbnail left.
- **Numbered list (desktop sidebar):** big muted numerals 1–6.
- **Section block:** title + "और देखें" link, lead card, then 1–2 plain links with top borders.
- **Video band:** dark ink background, 16:9 thumbnails with play icon.
- **Article:** breadcrumb, H1, dek, byline row (40 px avatar — "LL" monogram for LokLens News Team), time with
  "अपडेट" time, share row (WhatsApp primary button, Facebook, X, copy link), full-bleed 16:9 image with
  caption, body, blockquote with 4 px brand left border, click-to-load video facade, tag chips, WhatsApp
  channel banner, "ये भी पढ़ें" related list.
- **Pagination:** "पेज X / Y" + "अगला पेज" primary button linking to `/{category}/page/{n}`.
- **Bottom nav (mobile only):** होम · वीडियो · ई-पेपर · श्रेणियां, 64 px, active = brand colour.
- **Footer:** logo + tagline, categories, LokLens links, policy links (editorial, corrections, privacy,
  terms, disclaimer), copyright.
- **AdSlot:** renders nothing at launch (Phase 7). Reserved heights when enabled: mobile 100 px (home/list),
  250 px (in-article, after paragraph 3), desktop 300×250 sidebar, 728×90 leaderboard.

## Rules

- Red is the brand (from the logo). Breaking = yellow badge with black text; live = pulsing red dot + "लाइव" text.
  Never rely on colour alone: badges always carry text.
- Touch targets ≥ 44 px. Text contrast ≥ 4.5:1 (all token pairs above pass on white).
- Icons: inline stroke SVG, 2 px stroke, `aria-hidden` with a labelled button.
- No auto-playing carousels; the home "featured" area is a static lead + secondary cards.
- Pine green `#0E5A4F` (v1) was replaced by logo red on 2026-11-09.

## Logo

- Source: `docs/brand/logo-square-1024.jpg` (square, 1024 px, red/white/black with globe and camera lens).
- Use it as: favicon/app icons (resized), Organization logo in JSON-LD, default share image background, and in the
  header at 48 px (mobile) / 72 px (desktop) height.
- Needed from the client later: an SVG or transparent PNG and a horizontal version for the header (the square
  logo's small text is hard to read below ~48 px). Until then the header shows the square logo plus the text
  "लोक Lens न्यूज़" for readability and SEO.
