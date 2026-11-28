# YouTube Studio Release 1 — launch (Phase 8)

Status: **prepared 2026-11-28, nothing deployed.** Every step below needs the user's approval; deploys only on the
user's word. Plan and phase history: `docs/youtube-studio-plan.md`. Internal contract: `docs/api-contract.md` §9.

The launch is built so that **deploying changes nothing for readers or editors**: with `YOUTUBE_STUDIO_ENABLED`
unset, the nav items are hidden, `/reporter/footage` and `/admin/youtube` show "यूट्यूब स्टूडियो अभी बंद है।",
the footage preview route returns 404 and the publisher does nothing. The studio is switched on later, on the
dev site first.

## 1. Branch and commit (user)

All Phase 1–7 work is **uncommitted** on top of `feat/account-deletion` (whose last commit, the Play Store release,
is not in `develop` yet). Suggested:

```powershell
git switch -c feat/youtube-studio
```

`git switch -c` keeps the uncommitted files. Commit only the app and docs; `tools/` (spike scripts, git-ignored
`.env` files inside) and `docs/ai-news-studio-plan.md` (separate plan) stay out unless wanted.

What the branch contains:

| Area | Files |
|---|---|
| Migrations (run automatically on boot, `prodMigrations`) | `20261127_172614_youtube_studio` (6 tables, RLS on), `20261127_174523_footage_retention_task`, `20261128_071732_youtube_publisher` — all **additive** |
| Cron | `app/api/cron/route.ts`, `lib/cron/queues.ts` — the plain call now runs only the `default` queue (push, receipts, breaking expiry, scheduled publishing: all already on `default`) |
| Data | `collections/Footage.ts`, `collections/YoutubePosts.ts` (+ events), `globals/YoutubeSettings.ts`, `access/youtube*.ts`, `hooks/youtube.ts` |
| Footage | `lib/footage/*`, `components/footage/*`, `/reporter/footage`, `jobs/footageRetention.ts` |
| Studio | `components/admin/YoutubeStudioView.tsx`, `components/youtube/*`, `lib/youtube/*`, `api/youtube/footage/[id]` |
| Publisher | `lib/google/oauth.ts`, `lib/youtube/{api,publishPlan,publisher}.ts`, `jobs/youtube.ts` |
| Nav | `AdminNav*.tsx`, `ReporterNav.tsx`, reporter layout (items only when the studio is on) |
| Dependency | `@aws-sdk/s3-request-presigner` ^3.1168.0 (was already installed indirectly, same version) |
| Docs | `api-contract.md` §9 (v1 draft 11), `architecture.md` §9, both `.env.example`, this file, the plan |
| Checks | `tests/unit/{cron-queues,youtube-rules,footage-segments,footage-range,youtube-post-input,youtube-publish-plan}.test.ts`, `scripts/verify-{youtube,footage,youtube-posts,publisher}.ts` |

Merge order: `feat/account-deletion` → `develop` first (or together), then `feat/youtube-studio` → `develop`.
Hostinger builds `develop`.

## 2. Checks before merging

| Check | Result (local, 2026-11-28) |
|---|---|
| `npm test` | 342 passed |
| `npx tsc --noEmit` | clean |
| ESLint on all changed files | clean (the full-repo lint has 4 older errors in untouched files) |
| `npm run build` (webpack, production) | passed; new routes `/reporter/footage` and `/api/youtube/footage/[id]` built |
| Migrations up → down → up on local Docker | clean |
| `verify-youtube.ts` / `verify-footage.ts` / `verify-youtube-posts.ts` | 22 / 19 / 19 passed |
| `verify-publisher.ts` (real channel, private, deleted after) | 15/16 — the one miss was the test itself (Payload queues scheduled jobs for the next minute); fixed |

## 3. Deploy with the studio OFF (user approves the deploy)

1. Merge into `develop`. Hostinger builds and the app runs the 3 migrations on boot (check the build/runtime log
   for `Migrated: 20261128_071732_youtube_publisher`).
2. Do **not** set `YOUTUBE_STUDIO_ENABLED` yet.
3. Smoke test (dev site, then production):
   - Home, an article, category pages, reporter login, admin dashboard: unchanged.
   - Admin sidebar: no "YouTube Studio" item. `/admin/youtube` shows "बंद है".
   - `/api/youtube/footage/1` → 404.
   - Existing cron still works: in hPanel's cron log (or `payload-jobs`), push receipts/breaking expiry keep running.
   - `curl -s -X POST https://dev.loklensnews.com/api/cron` without the secret → `401`;
     with the secret and `?queue=everything` → `400`.

**Done 2026-11-28:** PR #1 merged (ef005db). Hostinger auto-deploys `develop` to **both** `dev.loklensnews.com`
and `loklensnews.com`; both builds completed (07:56 UTC). Smoke test on both sites passed: home, `/api/v1/home`,
`/api/v1/shorts`, reporter login 200; `/admin/youtube` shows the admin login when signed out (no studio content);
`/reporter/footage` redirects; `/api/youtube/footage/1` 404; `/api/cron` and `?queue=youtube` without the secret
401; `footage`, `youtube-posts`, `youtube-settings` REST 403 for anonymous visitors. The app booted, so the
migrations ran. Still to check by a signed-in admin: no "YouTube Studio" sidebar item.

## 4. Environment variables (user, hPanel → the site → Node.js → Environment variables)

Set on `dev.loklensnews.com` first; production later. Saving restarts the app.

| Variable | Value | Notes |
|---|---|---|
| `YOUTUBE_OAUTH_CLIENT_ID` | from `tools/ai-spike/.env` | client "LokLens YouTube Studio", project `loklensnews` |
| `YOUTUBE_OAUTH_CLIENT_SECRET` | from `tools/ai-spike/.env` | secret: paste it yourself, never into chat |
| `YOUTUBE_OAUTH_REFRESH_TOKEN` | from `tools/ai-spike/.env.oauth` | secret; the @loklensnews consent from 2026-11-27 |
| `FOOTAGE_S3_BUCKET` | `loklens-footage` | private bucket (exists) |
| `YOUTUBE_CHUNK_MB` | leave unset (8) | tune after §6 |
| `YOUTUBE_STUDIO_ENABLED` | `true` | **last**, only when ready to test |

The `S3_*` variables are already set and are reused for the footage bucket. Hostinger's panel replaces the whole
variable list on save in some views: check the existing ones are still there afterwards.

## 5. Second cron entry (user, hPanel → Advanced → Cron Jobs, every minute)

Only for sites **with** `CRON_SECRET` (production). A site without it (the dev site, local development) runs the
`default` and `youtube` queues inside the app every minute (`jobs.autoRun` in `payload.config.ts`), so it needs no
cron entry at all.

```bash
curl -s -m 100 -X POST -H "x-cron-secret: YOUR_CRON_SECRET" "https://dev.loklensnews.com/api/cron?queue=youtube" > /dev/null
```

Same secret as the existing entry. `-m 100`: one step sends chunks for about 40 seconds, plus reading the footage
and the YouTube calls; Cloudflare cuts requests at about 100 seconds. The existing `/api/cron` entry stays as it is.

## 6. First real run on the dev site (private, deleted afterwards)

1. Set `YOUTUBE_STUDIO_ENABLED=true` and restart. Admin → **YouTube Settings** (sidebar "More") → tick **enabled**,
   keep **default privacy: unlisted** and **daily limit 20**.
2. Reporter Desk → **Video Footage**: upload a real phone clip (1–3 minutes) over mobile data. Check the
   progress bar, and resume by reloading mid-way and choosing the same file. (Tests browser → Supabase uploads
   from the live domain, which so far ran only from localhost.)
3. Admin → YouTube Studio → **नई पोस्ट**: that footage, a title, a thumbnail, **privacy: निजी (private)**,
   notifications **off**. Submit; as admin, review, tick the checklist, approve.
4. Within a few minutes the post goes **अपलोड हो रहा है → यूट्यूब पर प्रोसेस → प्रकाशित**. In the post's history,
   each "अपलोड जारी" line is one cron step: bytes per step ÷ ~40 s = **Hostinger → YouTube speed**. Write it in
   the plan (§12a). If a step sends less than ~16 MB, keep `YOUTUBE_CHUNK_MB` at 8; if much more, try 16.
5. Open the video in YouTube Studio: private, Hindi title/description/hashtags, thumbnail.
6. Delete the test video in YouTube Studio, cancel/delete the post, delete the footage.

## 7. Production

After §6 passes: repeat §4 and §5 for `loklensnews.com` (the cron URL without `dev.`), then enable. For the first
weeks keep **default privacy: unlisted**, so a mistake is never public; editors choose public per post.

## 8. Rollback

| Problem | Do |
|---|---|
| Anything wrong with uploads | Admin → YouTube Settings → untick **enabled** (stops the publisher at once) |
| Turn the whole studio off | Remove `YOUTUBE_STUDIO_ENABLED` (hides the screens, publisher idle) |
| Stop background calls | Pause the `?queue=youtube` cron entry |
| Channel access revoked / token error | Posts show "Google token refresh failed: invalid_grant": re-run the consent (`tools/ai-spike`, `npm run oauth`) and replace `YOUTUBE_OAUTH_REFRESH_TOKEN` |
| Code rollback | Revert the merge; the migrations are additive and can stay (old code ignores the new tables) |

## 9. What to watch in the first week

- Review tab: posts stuck in **समीक्षा में** (nobody approving) or **विफल** (read the error, retry from the panel).
- A post in **अपलोड हो रहा है** for more than ~15 minutes: check the cron entry runs (hPanel log) and the post's
  last error.
- Quota: Google Cloud → APIs & Services → YouTube Data API v3 → Quotas. Expected per video: 1 upload unit
  (100/day), ~50 thumbnail, a few polls.
- Supabase Storage size (Free: 1 GB): footage is deleted 30 days after upload when unused, and 30 days after
  publishing. Lower `footageRetentionDays` in YouTube Settings if space gets tight.
- Push notifications still arrive (the cron change touched their runner).

## 10. Known limits of Release 1

- No editing on YouTube after upload (title/description changes go through YouTube Studio).
- Shorts use YouTube's own thumbnail frame. Videos recorded in a browser do not report their length, so they
  cannot pass the Short check; phone camera files do.
- AI suggestions are off (decision 2026-11-27); editors write the metadata.
- Supabase Free caps each object at 50 MB, so footage is stored in 45 MB segments (2 GB per clip by default).
- One upload step per minute per site (~40 s of sending): at ~2 MB/s a 1 GB clip needs about 13 cron steps,
  so roughly 13 minutes.
