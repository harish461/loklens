# LokLens YouTube Studio — Release 1: audit and plan

Status: **plan approved by the user on 2026-11-27, with Option B** (new private `footage` collection for raw
video; `media` reused for thumbnails). Nothing is built yet. Each phase below still needs its own approval, and
so does every deploy. The proposed defaults in §11.7 apply unless the user changes them: admins approve,
reporters upload footage only, new videos default to unlisted, footage is kept 30 days, footage is capped at 2 GB.

Builds on `docs/ai-news-studio-plan.md` (same Google project, same AI provider, same queue approach).

## 1. Current architecture (relevant facts)

| Area | Fact | File |
|---|---|---|
| Stack | Next 16.4.5 (webpack), React 19.2, Payload 3.93, Postgres (Supabase, pool 5), sharp 0.35, `@aws-sdk/client-s3` already a direct dep | `apps/web/package.json` |
| Payload config | 15 collections, 3 globals, GraphQL off, `push:false` + `prodMigrations` (migrations at boot), global `upload.limits.fileSize` = 50 MB | `src/payload.config.ts` |
| S3 | One `s3Storage` plugin, only `media`, prefix `images`, `disableLocalStorage`, file proxy kept (`/api/media/file/...`), bucket default `loklens-media`, region ap-northeast-2 | `payload.config.ts` |
| Plugin internals | `@payloadcms/storage-s3` 3.93 supports `clientUploads`, but it is ONE presigned `PutObject` (10-min expiry), checked against the GLOBAL 50 MB limit, no resume. `lib-storage` and `s3-request-presigner` are present only transitively. | `node_modules/@payloadcms/storage-s3/dist/generateSignedURL.js` |
| Media | Images only (jpeg/png/webp/avif), ≤10 MB hook, originals ≤2560 px re-encoded to WebP, 7 sizes, `alt` required, **read: anyone**, create: staff, delete: editors | `src/collections/Media.ts` |
| Videos | Site video entries by `youtubeId`; `parseYouTubeId`, `YOUTUBE_ID` reusable | `src/collections/Videos.ts` |
| Roles | admin / editor / reporter; pure helpers + tests | `src/access/roles.ts`, `rules.ts`, `workflow.ts` |
| Trusted calls | `publishGuardViolations` and `reporterWorkflowViolations` return `[]` when there is no `req.user` → jobs bypass role guards | `src/access/rules.ts`, `workflow.ts` |
| Article publishing | draft → pending_review → published/rejected, `syncWorkflow`, featured image ≥1200 px, push-on-publish only on real transition | `src/hooks/articles.ts`, `src/lib/push/publish.ts` |
| Admin actions | `staff(requireAdmin)` re-checks session + `isActive` + role, writes with `overrideAccess:false` | `src/lib/admin/actions.ts` |
| Admin views | Custom views in `admin.components.views` (`/review`, `/notifications`, `/reporters`); `adminShell()`; query-string tabs; admin-only items behind `isAdmin` in nav | `payload.config.ts`, `components/admin/NotificationsView.tsx`, `ReviewViews.tsx`, `AdminNavClient.tsx` (L185) |
| Reporter workspace | `/reporter/*`, `requireReporter()` / `checkReporter()` on every page and action; uploads go browser → `POST /api/media` (multipart through the app) | `src/lib/reporter/session.ts`, `components/reporter/ArticleForm.tsx:56` |
| Jobs | tasks `expireBreaking`, `pushArticlePublish`, `pushSend`, `pushReceipts` + schedulePublish; autoRun only without `CRON_SECRET`; job access editor/admin | `payload.config.ts`, `src/jobs/push.ts` |
| Cron | `POST /api/cron` (timing-safe `x-cron-secret`) runs `handleSchedules({allQueues:true})` then **`jobs.run({ allQueues: true, limit: 10 })`** inline | `src/app/api/cron/route.ts` |
| Lease pattern | Atomic `UPDATE … SET lease_until … WHERE lease_until IS NULL OR < now()` | `src/lib/push/send.ts:76` |
| Migrations | New task slugs need `ALTER TYPE enum_payload_jobs(_log)_task_slug ADD VALUE`; RLS migration was one-off | `src/migrations/20261126_131229_push_job_tasks.ts`, `20261127_081621_enable_rls_public_tables.ts` |
| API | `/api/v1/*` read-only + auth/me/push; `/api/v1/videos`, `/shorts` read the channel Atom feed (`lib/social/youtube.ts`) | `src/app/api/v1/*` |
| Env names | root `.env.example`: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CRON_SECRET, DATABASE_URL, EXPO_ACCESS_TOKEN, GOOGLE_CLIENT_IDS, NEXT_PUBLIC_SITE_URL, PAYLOAD_SECRET, PREVIEW_SECRET, REVALIDATE_SECRET, S3_* (5). `apps/web/.env.example` adds CONTACT_RECEIVER_EMAIL, SMTP_* (4) but lacks CRON_SECRET, EXPO_ACCESS_TOKEN, DB_POOL_MAX. `apps/web/.env` has DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_SITE_URL, PREVIEW_SECRET, REVALIDATE_SECRET, S3_* (5), CONTACT_RECEIVER_EMAIL, SMTP_* (4). Values not read. | |

## 2. Findings

1. **Cron runs every queue.** `/api/cron` uses `allQueues: true`. A new `youtube` (or `ai`) queue would run inside the default per-minute call, next to push. The AI Studio plan assumes the default call runs only `default`; the code does not. Fix first: default call → `queue: 'default'`; new `?queue=<name>` mode, limit 1.
2. **Media is the wrong home for raw footage as it is:** public read (unpublished footage would be served through `/api/media/file/...`), uploads go through the app (Payload buffers the file; 120 s Hostinger / ~100 s Cloudflare limits), 50 MB global cap, image-only hooks, and every media picker (article editor, reporter form, `featuredImage`, `videos.thumbnail`) would list videos.
3. **Payload `clientUploads` does not solve large files:** a single presigned PUT, no resume, global 50 MB cap, and enabling it changes the production image flow for `media`.
4. **Jobs have no user**, so any YouTube approval guard must check stored state (`approvedAt`, status) and not depend on `req.user` (same as the AI plan §4.3).
5. **Supabase per-file limit:** Free plan 50 MB max per file; paid plans up to 500 GB (S3 uploads). Plan tier must be confirmed. Whether the `loklens-media` bucket is public is unknown; footage needs a private bucket.
6. **Thumbnails need JPEG/PNG:** Media stores WebP; send-time conversion with sharp is needed.
7. Each new job task needs an enum migration; new tables need explicit `ENABLE ROW LEVEL SECURITY` (incl. `_rels`, `_v`).
8. `apps/web/.env.example` is missing CRON_SECRET, EXPO_ACCESS_TOKEN, DB_POOL_MAX (also in AI plan).

## 3. External facts (checked 2026-11-27, re-check in Phase 0)

| Topic | Current docs | Effect |
|---|---|---|
| videos.insert quota | 1 unit in a separate "Video Uploads" bucket, default **100 uploads/day**; 10,000 units/day for everything else. Older docs/calculator copies say 1,600 units. | Quota is not a constraint for R1. Confirm in Cloud Console Quotas. |
| thumbnails.set | ~50 units; ≤50 MB; image/jpeg or image/png; custom thumbnails need a **verified channel** (403 otherwise) | Convert WebP→JPEG; show a clear error |
| videos.update / videos.list | 50 / 1 unit | Status polling is cheap |
| Scopes | insert accepts `youtube.upload`, `youtube`, `youtubepartner`, `youtube.force-ssl` | One consent with `youtube.force-ssl` covers this and the AI plan's captions |
| Unverified projects | Since 2020-07-28 uploads were forced private until an API audit; the **current** videos.insert page says they are "not restricted to private viewing mode" | Phase 0: test-upload unlisted and verify; if locked, file the Audit form (weeks) |
| Shorts | No API flag. Vertical or square, **≤3 minutes** | Validate ratio + duration before upload |
| Max file | 256 GB, `video/*` | — |
| privacyStatus | Defaults to **public** if omitted | Always send it explicitly |
| publishAt | Scheduled publish: upload `private` + `status.publishAt` | Use YouTube's own scheduler |
| notifySubscribers | default true | Expose as a checkbox |
| Channel verification | Unverified channels: 15-min upload limit, no custom thumbnails (YouTube Help) | User verifies the channel |

## 4. Proposed architecture

```
Reporter (/reporter/footage) or editor (/admin/youtube)
  │ 1 server action: start → CreateMultipartUpload (private bucket, key footage/yyyy/mm/<id>.<ext>)
  │ 2 server action: sign parts → presigned UploadPart URLs
  │ 3 browser PUTs 16 MB parts straight to Supabase S3 (3 parallel, retry, resume via ListParts)
  │ 4 server action: complete → CompleteMultipartUpload + HeadObject + magic-byte check
  ▼
footage (row: key, size, mime, duration, w×h, uploader, consent)
  ▼
youtube-posts  (editor drafts: type normal/short, footage, thumbnail→media, AI metadata, privacy/schedule, article?)
  │ submit → pending_review → admin Approve (server action, stamps approvedBy/At + content hash)
  ▼
job ytUploadStart (queue youtube)   OAuth refresh → resumable session URI (server-only field)
job ytUploadChunk (re-queues itself) lease → ask YouTube offset → S3 GetObject Range → PUT Content-Range
                                     time-boxed ≤60 s per run, chunks multiple of 256 KiB (8–32 MB)
job ytSetThumbnail                   media original → sharp JPEG → thumbnails.set
job ytCheckStatus                    videos.list status/processingDetails until processed (backoff)
  ▼
status published / scheduled / failed  + youtube-post-events (append-only history)
POST /api/cron?queue=youtube  (second Hostinger cron entry, every minute, limit 1)
```

Rules: one external call per step, no DB transaction held over network calls, lease per post (push pattern), kill switch `YOUTUBE_STUDIO_ENABLED` + settings flag, server-only modules (`import 'server-only'`) under `src/lib/youtube/*` and shared `src/lib/google/oauth.ts` (also used by AI Studio). YouTube via `fetch` (no `googleapis`).

## 5. Footage storage decision: widen `media` vs. a separate collection

| | A. Widen `media` | B. New `footage` collection (recommended) + reuse `media` for thumbnails |
|---|---|---|
| Public exposure | Must change `media.read` to a Where that hides videos; risk if bucket is public | Private bucket, presigned GET for admins only |
| Upload path | Through Payload or `clientUploads` (single PUT, 50 MB global) | Own resumable multipart, browser → S3 |
| Impact on live image flow | Touches the hooks, sizes, pickers, contract `ImageRef`, `onInit` SQL used by every article | None |
| Duplicate? | No | Not a duplicate: media = public images, footage = private raw video; thumbnails still use `media` |
| Work | Many guarded edits across editor/reporter/pickers | One new collection + upload UI |

Recommendation **B**. The user said "reuse Media"; B reuses it for thumbnails and AI-free images, and keeps raw video out of the public image library. If the user still prefers A, it is possible but needs: video mime types, a `kind` field, read Where, filterOptions on every image relation, raised global limit, and the same custom multipart path. **Decision needed.**

## 6. Collections and fields

### `footage` (group "YouTube Studio")
`title` (Hindi, req), `notes` (reporter brief: what/where/who/when), `storageKey` (unique, hidden), `bucket` (hidden), `filename`, `mimeType` (mp4/mov/webm), `sizeBytes`, `durationSeconds`, `width`, `height`, `orientation` (landscape/vertical/square, derived), `uploadStatus` (uploading/uploaded/failed/deleted), `multipartUploadId` (hidden), `location` → locations, `category` → categories, `rightsConfirmed` (checkbox, required: own footage, consent of people shown), `credit`, `createdBy`, `retainUntil` (date).
Access: create staff; read admin/editor all, reporter own; update reporter own while not used by an approved post; delete admin/editor (job deletes the S3 object). Never public.

### `youtube-posts`
`postType` (video/short), `footage` → footage (req), `article` → articles (optional), `title` (≤100 chars, no `<>`), `description` (≤5000 **bytes**; Devanagari ≈3 bytes/char), `tags` (array; total ≤500 chars), `hashtags` (array, max 15; first 3 shown), `categoryId` (default 25 News & Politics), `defaultLanguage`/`audioLanguage` (hi), `thumbnail` → media (optional; required for video type by setting), `privacyStatus` (public/unlisted/private), `publishAt` (optional; forces private upload), `notifySubscribers` (default true), `madeForKids` (false), `containsSyntheticMedia` (false), `playlistId` (optional, later), `status` (see §7), `reviewNote`, `submittedBy/At`, `approvedBy/At`, `approvedHash` (hash of metadata+footage+thumbnail), `youtubeVideoId`, `youtubeUrl`, `uploadSessionUri` (field access: none; server only), `bytesUploaded`, `leaseUntil`, `attempts`, `lastError` (short, no secrets), `ai` group (`run` → ai-runs, `suggestions` json, `promptVersion`), `createdBy`. Versions on (maxPerDoc 20, no drafts).
Access: read/create/update editor+admin; reporters none in R1; delete admin, and only before upload starts.

### `youtube-post-events` (append-only history)
`post` →, `type` (created/submitted/rejected/approved/upload_started/chunk/uploaded/thumbnail_set/processed/scheduled/published/failed/retried/cancelled), `actor` → users (null for jobs), `at`, `detail` json (offset, quota units, error code). Read admin/editor; no update/delete via API.

### Globals / shared
`youtube-settings` (admin): `enabled`, `dailyUploadLimit` (default 20), `maxFootageMB` (default 2048), `footageRetentionDays` (30), `defaultPrivacy` (unlisted for first weeks), `defaultHashtags`, `requireThumbnailForVideos`, `channelTitle` (cached).
`ai-runs` (from the AI plan, shared; create it in whichever release ships first).

Migration: one additive migration per phase, RLS on every new table, job enum values added.

## 7. Status machine (`youtube-posts.status`)

```
draft ─submit→ pending_review ─approve(admin)→ approved ─job→ uploading ─→ processing ─→ published
  ▲               │reject(note)                                │              │         └→ scheduled (publishAt) → published (poll)
  └───────────────┘                                            └──── failed ◀─┘ (retry → approved)
any edit to approved metadata/footage/thumbnail → back to pending_review (hash mismatch)
cancel: draft/pending_review/approved/failed → cancelled
```

Guard hook `youtubePostGuard` (beforeChange, pure helper in `src/access/youtube.ts` with unit tests): only admins move to `approved`; only internal job calls (`req.context.youtubeJob`) move to uploading/processing/published/failed; status `approved` requires `approvedAt` and matching hash, checked on the stored doc, not `req.user`.

## 8. Routes

| Route / surface | Who | Purpose |
|---|---|---|
| Server actions `lib/youtube/actions.ts` | staff (role per action) | start/sign/complete/abort footage upload, save post, AI suggest, submit, approve, reject, retry, cancel |
| Server actions `lib/reporter/footageActions.ts` | reporter | same upload actions, own footage only |
| `POST /api/cron?queue=youtube` | Hostinger cron (secret) | 1 job per call; default call becomes `queue:'default'` |
| (optional) `GET /api/admin/youtube/oauth/{start,callback}` | admin | in-app "Connect channel" if chosen instead of env refresh token |
| Payload REST for new collections | staff by access rules | admin only, not in the contract |
| `/api/v1/*` | — | **no change in R1** (site video sections already read the Atom feed) |

`docs/api-contract.md`: new §9 "YouTube Studio (internal)" stating no public API change, the staff-only collections, and statuses; change-log entry. Written before code.

## 9. Admin screens (Hindi UI)

Nav item "यूट्यूब स्टूडियो" (editor + admin) in `AdminNavClient.tsx`; view `/admin/youtube` with tabs:
1. **Overview** — today's uploads vs limit, in progress, failed (retry), channel connection, kill switch.
2. **Posts** — list with status filters.
3. **Editor** (`?tab=edit&id=`) — footage picker/uploader with progress and resume; type (Video/Short, auto-checked against ratio and ≤3 min); "AI से सुझाव लें" (3 title options, description, tags, hashtags, editable, byte counters); thumbnail (upload to media or choose); privacy + schedule; article link; notify subscribers; submit.
4. **Review** (`?tab=review&id=`, admin) — player (presigned GET), metadata, thumbnail preview, checklist (rights/consent, minors, no defamation, title accurate and not misleading), Approve & publish / Reject with note.
5. **History** — published/scheduled/failed with YouTube links and the event log.
Reporter: `/reporter/footage` (upload with brief + consent, list own uploads and whether used).

## 10. AI metadata (Claude)

- `@anthropic-ai/sdk`, model `claude-opus-5-5`, `output_config: { effort: 'low', format: <json schema> }` (Opus 5.5 default is medium; this is a short task), streaming + `finalMessage()`, 60 s timeout, `betas: ['server-side-fallback-2026-07-01']` + `fallbacks: 'default'`, check `stop_reason` (`refusal`, `max_tokens`).
- Input: footage brief, location, category, linked article title/summary/plain text (as delimited **data**, not instructions). No transcript in R1 (no speech-to-text).
- Output schema: `titles[3]`, `description`, `tags[]`, `hashtags[]`, `factsToVerify[]`. Server validates YouTube limits (100 chars, 5000 bytes, 500-char tags, no `<>`), and trims.
- Runs inline in a server action (short, interactive) with an abort at 60 s; logged in `ai-runs` (tokens, cost, model, user). Estimated ≈ $0.03–0.06 per suggestion. Limits: per-user daily cap and monthly budget in settings.

## 11. What the user must provide

1. Google Cloud project (same as AI Studio), YouTube Data API v3 enabled.
2. OAuth client (Web), consent screen **In production** (Testing = 7-day refresh tokens), one-time consent by the channel owner (brand account) with `youtube.force-ssl` → `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, `YOUTUBE_OAUTH_REFRESH_TOKEN`.
3. Channel phone-verified (custom thumbnails, >15-min videos).
4. Anthropic API key `ANTHROPIC_API_KEY` + Console spend limit.
5. Supabase: confirm plan (Free = 50 MB per file → Pro needed), create private bucket (e.g. `loklens-footage`), confirm S3 CORS exposes `ETag` for browser multipart; `FOOTAGE_S3_BUCKET`.
6. Hostinger: second cron entry `POST /api/cron?queue=youtube` every minute; env `YOUTUBE_STUDIO_ENABLED`.
7. Decisions: footage A/B; who approves (admin only proposed); reporter role in R1 (upload only proposed); default privacy for the first weeks (unlisted proposed); retention days; max footage size.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Hostinger→YouTube throughput unknown; 120 s/100 s limits | 60 s time-boxed chunk steps, resume by offset query; measure in Phase 0 |
| Browser multipart blocked by CORS/ETag on Supabase S3 | Phase 0 test; fallback Supabase TUS resumable or single presigned PUT ≤ limit |
| Supabase Free 50 MB cap / storage+egress cost | Pro plan; retention job deletes footage N days after publish |
| Unverified-project private lock still applied | Test upload; API audit form |
| Wrong video goes public | Admin approval, hash re-check, default unlisted, explicit privacyStatus |
| Two runners upload the same post | DB lease + idempotent session URI + `youtubeVideoId` uniqueness |
| Token expiry/revocation | Production consent; clear "re-connect" error; shared with AI plan |
| Cron change touches push | Small separate phase, tests, approval |
| DB pool of 5 | No open transactions during network I/O; limit 1 job per youtube call |
| Footage privacy (minors, victims) | Rights checkbox, review checklist, private bucket |
| AI titles clickbait/defamatory | Data-only prompt, factsToVerify, human edit + admin approval |

## 12a. Phase 0 (started 2026-11-27)

Scripts are in `tools/youtube-spike/` (stand-alone, uncommitted; see its README). They share the Google OAuth
client and refresh token with `tools/ai-spike/`. Test uploads are always unlisted or private, and the delete
script only removes videos the spike itself uploaded.

| Script | Answers |
|---|---|
| `npm run channel` | Right channel? Verified (`longUploadsStatus`)? |
| `npm run footage` | Browser multipart to the private bucket: CORS + ETag, Slow 4G, plan file limit, bucket privacy; is the media bucket public? |
| `npm run upload` | Resumable upload in 60 s steps, from disk or from S3; MB/s per step; private lock |
| `npm run status` | Processing state, real privacy vs requested |
| `npm run thumbnail` | WebP→JPEG + thumbnails.set, on a video and on a Short |
| `npm run metadata` | Claude titles/description/tags/hashtags: Hindi quality, limits, seconds, USD |

Findings so far (2026-11-27):
- **Google project:** the existing `loklensnews` project (it also holds the live Google Sign-In clients; the user chose to reuse it).
  YouTube Data API v3 is enabled. The consent screen is **In production**, with home, privacy and terms links and the
  authorised domain `loklensnews.com`. No scopes are added on the Data access page, so live sign-in stays outside
  verification; `youtube.force-ssl` is requested at runtime and shows the "unverified app" screen once.
- **OAuth client:** "LokLens YouTube Studio" (web, redirect `http://127.0.0.1:53682/callback`). ID and secret are in
  `tools/ai-spike/.env`, the refresh token in `.env.oauth` (both git-ignored).
- **Channel:** LokLens News `UCQ9BfhKRBEESTPyscj1JmCg` confirmed. `longUploadsStatus: allowed`, so the channel is
  verified (custom thumbnails and uploads over 15 minutes are OK).
- **Footage bucket:** `loklens-footage` created through the S3 API (CreateBucket). It is private: a test object's
  public URL returns HTTP 400.
- **Per-file cap: 50 MB.** A 60 MB multipart upload was refused at part 4 with `EntityTooLarge`. That is the Free
  plan limit, or a global upload limit set to 50 MB. Either way, footage over 50 MB cannot be stored as one object
  today.
- **Decision (user, 2026-11-27): segments, staying on the Free plan.** The browser slices each footage file
  into ≤45 MB segment objects (`footage/<id>/seg-0001` …), each a single presigned PUT with retry. The browser
  multipart and CORS/ETag question goes away. The `footage` doc stores the segment count, the sizes and a
  SHA-256 per segment. Resume means skipping segments already uploaded (HeadObject). The YouTube job streams the
  segments in order into the resumable session, using byte offsets across segment boundaries. Segment and
  YouTube chunk sizes are both multiples of 256 KiB, so each cron step reads 1 or 2 segments. Retention deletes
  the whole prefix. This changes Phase 4 ("multipart actions" → "segment upload actions") and the Phase 0 footage
  test (segments, not one multipart object).
- **Decision (user, 2026-11-27): AI metadata uses Google Gemini's free tier, not the paid Anthropic API.**
  The key comes from AI Studio, with no billing on its project. Structured JSON output uses `responseSchema`. The
  model ID is configurable (`YT_GEMINI_MODEL`); by default the newest stable "flash" text model is used. Trade-offs:
  free-tier inputs may be used by Google to improve its products (acceptable for public news briefs; do not send
  private material), the daily request limits are lower, and a 429 means "try later", never a fallback to a paid
  model. The app keeps the provider behind one `lib/ai` interface, so Anthropic can be switched on later without
  UI changes. This affects the shared AI provider in `docs/ai-news-studio-plan.md`, which should follow the same
  choice.
- **Decision (user, 2026-11-27, later the same day): leave AI out of Release 1 for now.** Editors type the title,
  description, tags and hashtags themselves. The AI-suggestions button stays behind a feature switch,
  `YOUTUBE_AI_ENABLED`, which is off by default; when it's off, the button and the `ai-runs` logging are hidden.
  Phase 6 (AI metadata) is deferred until the user decides; the Gemini path in the spike is ready but not run.
  Phase 0 runs only the YouTube tests.
- Still waiting for: test clips. Hostinger's own network speed is measured in Phase 7.

## 13. Phases (each: branch from develop, approval, no deploy without approval)

| # | Phase | Deliverable | Verification |
|---|---|---|---|
| 0 | Spike (scripts in `tools/youtube-spike/`, no app code) | OAuth token, test resumable upload (unlisted) from local and from Hostinger, throughput per 60 s, private-lock check, thumbnails on a Short, Supabase plan/CORS/multipart from browser | Findings note |
| 1 | Docs (**drafted 2026-11-27, awaiting review**) | `api-contract.md` §9 (v1 draft 11), `architecture.md` §9 "YouTube Studio", YouTube names in both `.env.example` files (+ CRON_SECRET, EXPO_ACCESS_TOKEN, DB_POOL_MAX in `apps/web/.env.example`) | User review |
| 2 | Cron queue isolation (**done 2026-11-27, uncommitted, not deployed**) | `src/lib/cron/queues.ts` (allow-list `default` limit 10, `youtube` limit 1; unknown → 400; no "all queues" mode); route uses `handleSchedules/run({ queue })`. Scheduled publish and push jobs all use `default` (checked). The AI Studio plan's `?queue=ai` must be added to the allow-list when it is built. | `tests/unit/cron-queues.test.ts` (9 tests) |
| 3 | Data model + guard (**done 2026-11-27, uncommitted, not deployed**) | `collections/Footage.ts`, `collections/YoutubePosts.ts` (+ `youtube-post-events`), `globals/YoutubeSettings.ts`; rules `access/youtube.ts` + hook `hooks/youtube.ts`; migration `20261127_172614_youtube_studio` (6 tables, RLS on all, down reordered by hand). Changes from §6: no Payload versions on posts (they would copy `uploadSessionUri`; events are the history), `youtube-post-events.post` is optional (so a never-uploaded post can be deleted), no `ai` group or `ai-runs` (AI deferred), no new job tasks yet (Phase 7). User-less writes without `context.youtubeJob` are refused. | `tests/unit/youtube-rules.test.ts` (33), `scripts/verify-youtube.ts` (22 checks on local DB), migrate up → down → up on local Docker, typecheck, lint, full suite 298 |
| 4 | Footage upload (**done 2026-11-27, uncommitted, not deployed**) | `lib/footage/{segments,storage,service,actions,queries,retention}.ts`; `components/footage/{FootageUploader,FootageList}.tsx`; reporter page `/reporter/footage` + nav item; admin view `/admin/youtube` (footage tab) + nav item, both only while `YOUTUBE_STUDIO_ENABLED=true`; job `footageRetention` (hourly, default queue) + enum migration `20261127_174523_footage_retention_task`; `@aws-sdk/s3-request-presigner` now a direct dependency. Unused footage expires 30 days after upload (Phase 7 extends it for published posts). | `tests/unit/footage-segments.test.ts` (14); `scripts/verify-footage.ts` (19 checks, real bucket + local DB); real browser upload of 50 MB (2 segments) on localhost as a reporter — Supabase S3 accepted the cross-origin PUTs. **Not yet tested:** a 1 GB file over a throttled phone network, and CORS from the production domain. |
| 5 | Studio UI + approval (**done 2026-11-28, uncommitted, not deployed**) | `/admin/youtube` tabs: सभी पोस्ट (status filter), नई पोस्ट/संपादन (footage picker with preview player, live YouTube counters, thumbnail pick/upload, privacy, IST schedule, article link), समीक्षा (admin panel: player, "what goes to YouTube", 4-point checklist, approve/return with note, retry failed), इतिहास, फ़ुटेज. `lib/youtube/{postInput,postService,studioQueries,studioActions}.ts`, `components/youtube/*`, preview route `GET /api/youtube/footage/:id` (Range across segments). Browser-safe constants moved to `access/youtubeLimits.ts`. Every step writes `youtube-post-events`. | `tests/unit/youtube-post-input.test.ts` (8), `footage-range.test.ts` (7); `scripts/verify-youtube-posts.ts` (19 role checks: reporter/editor/admin); browser: admin uploaded a real WebM, created a post, preview played, submitted, approved with the checklist; phone width checked. |
| 6 | AI metadata | Claude suggest, limits, ai-runs | Mocked tests + 5 real suggestions reviewed by user |
| 7 | Publisher jobs (**done 2026-11-28, uncommitted, not deployed**) | `lib/google/oauth.ts` (refresh-token exchange, cached), `lib/youtube/{api,publishPlan,publisher}.ts`, task `youtubePublish` (every minute, `youtube` queue, one step per call: session → ~40 s of chunks from segments → thumbnail JPEG 1280×720 → poll → published/scheduled), lease per post, error classes (quota wait 1 h, retry with backoff up to 8, session reset, permanent → failed), daily upload limit by India day, footage released after publishing. Hashtags go at the end of the description and count toward the 5000 bytes. New fields `nextCheckAt`, `thumbnailSetAt`; migration `20261128_071732_youtube_publisher`. | `tests/unit/youtube-publish-plan.test.ts` (15, incl. mocked upload protocol); `scripts/verify-publisher.ts` against the REAL channel: private upload of a 3.4 MB clip in 4 time-boxed 1 MB steps, thumbnail set, processed → published as private, history complete, then the video was deleted; job wiring checked (default queue does not run it, youtube queue does). Payload queues a scheduled job for its next minute, so in production each cron call runs the one queued a minute earlier. **Not yet measured:** Hostinger → YouTube speed (Phase 8, kill switch on, private uploads). |
| 8 | Launch (**prepared 2026-11-28, not started**) | step-by-step in `docs/youtube-studio-launch.md`: branch + merge, deploy with the switch off, env vars, second cron entry (`-m 100`), private test on the dev site (measures Hostinger → YouTube speed), then production with unlisted default; rollback and first-week watch list | Live checks |
