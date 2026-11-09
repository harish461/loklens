# Social feeds — setup guide

The home page shows the 3 latest posts from YouTube, Facebook and Instagram (architecture.md, "Social feeds").

## YouTube — nothing to do

Uses the channel's public feed (channel id `UCQ9BfhKRBEESTPyscj1JmCg`, handle `@loklensnews`). No key needed.

## Facebook + Instagram — deferred (not built yet)

Not part of the current build (decision 2026-11-09: YouTube only for now). Keep these steps for later.

### One-time setup by the page owner

Meta only gives a Page's posts through the Graph API, so the page owner creates a token once.
**Do this yourself; never paste tokens into chat, email or the repo.** Put them only in the server's `.env`.

1. **Instagram account type:** in the Instagram app, switch `loklens_news` to a **Professional (Business or
   Creator)** account, then link it to the "LokLens Samachar" Facebook Page (Page settings → Linked accounts).
2. **Create a Meta app:** go to developers.facebook.com → My Apps → Create app → type "Business".
   Add the products **Facebook Login for Business** and **Instagram Graph API** (Instagram API with Facebook Login).
3. **Get a user token:** in Graph API Explorer, select your app, and request these permissions:
   `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `business_management`. Log in as a Page admin.
4. **Make it long-lived:** exchange it for a long-lived user token (Access Token Debugger → "Extend Access Token").
5. **Get the Page token:** call `GET /me/accounts` with the long-lived user token. The `access_token` shown for
   "LokLens Samachar" is a Page token that does not expire. Also note the Page `id`.
6. **Get the Instagram user id:** call `GET /{page-id}?fields=instagram_business_account`. The returned `id` is
   the Instagram user id.
7. **Add to the server `.env`** (and `apps/web/.env` for local development):

   ```
   META_PAGE_ACCESS_TOKEN=...      # Page token from step 5
   FACEBOOK_PAGE_ID=...            # from step 5
   INSTAGRAM_USER_ID=...           # from step 6
   META_GRAPH_VERSION=v24.0        # optional; current Graph API version
   ```

8. Restart the site. Posts appear within 15 minutes.

Once built, until these are set the Facebook and Instagram blocks would show a "follow us" button instead of posts.

## If posts stop appearing

- The Page token stops working if the admin changes their Facebook password or removes the app — repeat steps 3–5.
- Check the server log for `[social]` warnings.
