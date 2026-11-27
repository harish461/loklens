# Push notifications

Contract: `docs/api-contract.md` §8. Branch: `feat/push-notifications`.

## How it works

```
App (expo-notifications)          Website / Payload (Hostinger)                     Expo push service
────────────────────────          ─────────────────────────────                     ─────────────────
sign-in → permission → token ──▶  POST /api/v1/push/devices  → push-devices
settings screen ──────────────▶   GET/POST /api/v1/push/preferences
                                  Article published ─▶ job pushArticlePublish
                                  Admin "Create"   ─▶ push-notifications ─▶ job pushSend ──▶ /push/send (≤100/request)
tap → article, POST events ───▶   /api/v1/push/events (opened)      ◀── tickets
                                  job pushReceipts (every 5 min) ──────────────────▶ /push/getReceipts (≤1000)
Hostinger cron (every minute) ─▶  POST /api/cron (wakes the app, runs due jobs)
```

- **Signed-in readers only.** Every device is linked to an `app-users` account; the server takes the user from the
  session, never from the request.
- **Per-device settings:** master switch, breaking news, general updates, and one switch per category (stored as
  the list of *muted* category IDs, so new categories are on by default).
- **Automatic on publish:** the article field "Push notification on publish" — *Automatic* (sends for breaking news
  only, the default), *Send*, *Don't send*. Sent once per article (unique key `article-publish:{id}`); editing,
  unpublishing and republishing never send again. A draft save never sends.
- **Admin → Notifications** (admins only): overview, create (with preview and confirmation), history with filters.
- **Honest numbers:** *accepted* = Expo accepted it; *handed to Android/iOS* = Expo's receipt; *opened* = taps the
  app reported. Nothing is called "delivered": no service confirms the phone displayed it.
- **Dead tokens:** a `DeviceNotRegistered` ticket or receipt deactivates the device.
- **Large audiences:** sent in slices of 500 devices (5 Expo requests of 100); each slice is its own job and the
  cursor is saved after every 100, so a retry repeats at most one batch.

### Files

| Area | Files |
|---|---|
| Collections + migrations | `apps/web/src/collections/Push*.ts`, `Articles.ts` (`pushOnPublish`), `migrations/20261126_125206_push_notifications.ts`, `20261126_131229_push_job_tasks.ts` |
| Server logic | `apps/web/src/lib/push/` (`rules`, `expo`, `send`, `publish`, `devices`, `manual`, `manualSend`), `jobs/push.ts` |
| API routes | `apps/web/src/app/api/v1/push/*`, `apps/web/src/app/api/cron/route.ts` |
| Admin | `components/admin/NotificationsView.tsx`, `NotificationsClient.tsx`, `lib/admin/notifications.ts`, `notificationActions.ts`, article editor select |
| Mobile | `apps/mobile/src/lib/push/notifications.ts`, `components/PushHandler.tsx`, `PushOptInCard.tsx`, `app/notification-settings.tsx`, `app.json` plugin |
| Tests | `apps/web/tests/unit/push-*.test.ts` (33 tests), `apps/web/scripts/verify-push.ts` (`npm run push:verify`, local DB) |

## What has been verified, and what has not

Verified on this machine:
- Unit tests for targeting, publish rules, payload shape, Expo client retries/limits, admin form validation.
- `npm run push:verify` against the local database **and the real Expo push service** (fake tokens): 17/17 —
  one notification per publish, only opted-in devices, muted category and master switch respected,
  `DeviceNotRegistered` deactivates the device, no re-send on edit/unpublish/republish, auto/skip rules,
  send-now to breaking subscribers, double-submit protection, schedule + cancel.
- HTTP checks of every `/api/v1/push/*` route and `/api/cron` on localhost (401 / 404 / 422 cases, token moving
  between accounts).
- Admin page renders for an admin; an editor is redirected to `/admin`; signed-out users get the login page.
- Mobile web build loads; the settings screen reports "Not available here" on the web.

**Not verified yet — needs Firebase and a new APK:** a real phone receiving a notification, tapping it open (warm
and from closed), the permission prompt, token rotation, and receipts for a real token.

## Setup you need to do

### 1. Firebase (Android delivery) — required

Expo's push service delivers to Android through Firebase Cloud Messaging (FCM).

1. https://console.firebase.google.com → **Add project** (e.g. "LokLens News"). Analytics is not needed.
2. **Done (2026-11-27):** Firebase project **`loklens-news`** (LokLens Gmail account) has the Android app
   `com.loklensnews.app`; its `google-services.json` is in `apps/mobile/` and referenced by
   `android.googleServicesFile` in `apps/mobile/app.json`. It is Firebase *client* configuration, not a secret.
   To refresh it: `firebase apps:sdkconfig ANDROID 1:977262364056:android:912ca8e34479fe26d0d7ed --project loklens-news`.
3. Firebase → ⚙ **Project settings → Service accounts → Generate new private key**. This JSON **is a secret**:
   do not commit it, do not send it in chat.
4. Upload it to Expo: https://expo.dev → project **loklens-news** → **Credentials** → **Android** →
   `com.loklensnews.app` → **FCM V1 service account key** → **Upload**.
   (Or `npx eas-cli@latest credentials` → Android → Google Service Account → Manage FCM V1.)
5. Build a new APK (`eas build --profile preview --platform android`). `expo-notifications` adds native code,
   so the old APK cannot receive pushes; Expo Go cannot either.

### 2. iOS (APNs) — later

Needs an Apple Developer Program membership; EAS then creates the APNs key during the first iOS build. Nothing in
the code is Android-only, but there is no iOS build yet.

### 3. Hostinger environment variables

Add in hPanel → the site → **Node.js → Environment variables** (both `loklensnews.com` and `dev.loklensnews.com`
if both run this code):

| Variable | Value |
|---|---|
| `CRON_SECRET` | new random value: `openssl rand -hex 32` |
| `DB_POOL_MAX` | optional; default 5 |
| `EXPO_ACCESS_TOKEN` | optional; only if you turn on *Enhanced push security* in the Expo project (expo.dev → project → Settings). Create the token at expo.dev → Account → Access tokens. |
| `GOOGLE_CLIENT_IDS` | already set (Web client ID) |

### 4. Hostinger cron job (every minute)

Hostinger stops the Node app after 5 minutes without requests, and background jobs stop with it. The cron call wakes
the app and runs due work (push sending, scheduled notifications, receipts, scheduled publishing, breaking expiry).

hPanel → **Advanced → Cron Jobs** → *Custom* → every minute (`* * * * *`), command:

```bash
curl -s -m 50 -X POST -H "x-cron-secret: YOUR_CRON_SECRET" https://loklensnews.com/api/cron > /dev/null
```

Check it: `curl -s -X POST https://loklensnews.com/api/cron` without the header must return `401`.

### 5. Supabase: check Row Level Security (security)

Supabase serves tables in the `public` schema over its REST API. The four new push tables have RLS **on** (added by
the migration). Please also check the **existing** tables: Supabase dashboard → **Table Editor** — any table marked
*RLS disabled* (for example `users`, which holds password hashes) should get RLS enabled with no policies
(Authentication → Policies → *Enable RLS*). Payload connects as the table owner and is not affected.

## Deploying

1. Review and merge `feat/push-notifications` into `develop`. Hostinger builds `develop`; the build runs the two new
   migrations automatically (`prodMigrations`).
2. Add the environment variables (step 3), save (the app restarts), and add the cron job (step 4).
3. Build and install the new APK after the Firebase steps (step 1).

## Testing checklist (real phone, new APK)

| # | Scenario | How |
|---|---|---|
| 1 | Fresh install | Install APK, sign in: the home card "ब्रेकिंग न्यूज़ अलर्ट पाएं" appears once |
| 2 | Permission granted | "चालू करें" → allow → Profile → Notifications shows the switches; Admin overview *Active devices* +1 |
| 3 | Permission denied | Deny → card disappears; Notifications screen offers "Open phone settings" |
| 4 | Token registered | Admin → Collections → Push devices shows the phone (platform, app version, last seen) |
| 5 | Manual notification | Admin → Notifications → Create → Send now → phone shows it; History: targeted/accepted 1 |
| 6 | Publish | Publish a breaking article (Automatic) → one notification |
| 7 | Category subscribers | Publish with *Send* in a category that is on → received |
| 8 | Muted category | Switch a category off → publish there with *Send* → not received (targeted 0) |
| 9 | Tap opens article | Tap while the app is open / in background → article screen |
| 10 | Tap from closed | Swipe the app away → tap → app starts on the article |
| 11 | No duplicates | Edit and re-save, unpublish and republish → no second notification |
| 12 | Invalid tokens | Uninstall the app → next send: ticket/receipt `DeviceNotRegistered` → device inactive |
| 13 | Two devices | Same account on two phones → both receive; settings are separate |
| 14 | Unauthorized | Editor account → `/admin/notifications` redirects; `/api/cron` without secret → 401 |
| 15 | Regression | Sign-in, Google sign-in, home, article, categories, splash still work |
| — | Receipts | 15+ minutes after a send, History *Handed over* fills in (needs the cron job) |

## Production launch checklist

- [ ] Firebase project + `google-services.json` in the app + FCM V1 key uploaded to Expo
- [ ] New APK built with `expo-notifications`; scenarios 1–15 pass on a real phone
- [ ] `feat/push-notifications` merged; migrations ran (Hostinger build log)
- [ ] `CRON_SECRET` set; cron job runs every minute; `/api/cron` returns 401 without the header
- [ ] Supabase: RLS enabled on all `public` tables
- [ ] Decide on `EXPO_ACCESS_TOKEN` (Enhanced push security) before a public launch
- [ ] Play Store listing: privacy policy mentions push notifications and the device token
