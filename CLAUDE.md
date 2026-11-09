# LokLens News — Project Brief

Rebuild of **loklensnews.com**, a Hindi news site covering Uttarakhand (tagline: "आपकी आवाज़, आपकी खबर"),
starting from scratch. A mobile app will follow, using the same backend.

## Decisions (locked)

| Area | Choice |
|---|---|
| Web framework | Next.js (App Router, TypeScript, server-rendered / ISR for SEO) |
| CMS + API | Payload CMS 3 — runs inside the Next.js app, provides admin panel + REST/GraphQL API |
| Database | PostgreSQL |
| Hosting | Single VPS (Docker Compose: app + Postgres + reverse proxy), Cloudflare CDN in front |
| Mobile app (later) | React Native (Expo), consuming the Payload API |
| Language | TypeScript everywhere |

## Repository layout (planned)

```
apps/web/        Next.js + Payload (site + admin + API)
  src/collections/    Payload collections (backend agent)
  src/app/(site)/     Public pages (frontend agent)
  src/app/(payload)/  Payload admin routes (generated, don't hand-edit)
  src/components/     UI components (frontend agent)
  src/lib/seo/        Metadata + structured-data helpers (seo agent)
apps/mobile/     Expo app (later, mobile agent)
infra/           Docker, reverse proxy, backups, CI scripts (devops agent)
docs/            Audit, architecture, API contract, decisions
.claude/agents/  Specialist agent definitions
```

## Content model (from the current site)

- **Categories:** देश, प्रदेश, समाज, राजनीति, खेल, दुनिया (more may be added by editors)
- **Article:** Hindi title, slug, summary, rich-text body, featured image, category, tags, author,
  published date, flags: `isBreaking`, `isTrending`, `isFeatured`
- **Video** section, **ई-पेपर** (e-paper, PDF per date), static pages (हमारे बारे में, संपर्क करें,
  विज्ञापन दें, गोपनीयता नीति, नियम व शर्तें)
- Home page: trending ticker, breaking/featured slider, latest feed, category blocks

## Working rules (all agents)

- The **API contract** in `docs/api-contract.md` is the source of truth between backend, frontend and
  mobile. Change it first, then the code — never silently diverge.
- UI text is **Hindi** (Devanagari). Code, comments and commit messages are English.
- Mobile-first: most readers are on phones on slow connections. Every page must be fast.
- Stay inside your own folders (see each agent file). If a change is needed elsewhere, report it
  instead of making it.
- No secrets in the repo. Use `.env` (git-ignored) and keep `.env.example` up to date.
- Small, reviewable changes. Each task ends with: what changed, how it was verified, open questions.
- Work on a feature branch; the user decides when to merge.

## Phases

1. Discovery & audit of the current site → `docs/audit.md`
2. Architecture + API contract → `docs/architecture.md`, `docs/api-contract.md`
3. Design system & wireframes (user approves)
4. Build: backend → frontend → SEO wiring
5. Staging, QA, redirects, launch
6. Mobile app
