# Deploy the development site on a Hostinger VPS

Status: **draft, not yet run on a server.** Nothing here is verified until the steps are done and the checklist at the end passes.

Target: `dev.loklens.com` from the `develop` branch. Production (`loklens.com`, `main`) is a separate step later.

## What runs on the server

| Piece | Where | Notes |
|---|---|---|
| Next.js + Payload (site, admin, API) | Docker container `app` | Port 3000, internal only |
| PostgreSQL 16 | Docker container `db` | Port 5432 bound to 127.0.0.1 only |
| HTTPS and reverse proxy | Docker container `caddy` | Ports 80 and 443; Let's Encrypt certificate |
| Uploaded images | Docker volume `media` | Must be backed up later (not yet automated) |

The database and media stay on the VPS. Secrets live only in `apps/web/.env` on the server, never in GitHub.

## Step 1: Hostinger VPS (you do this in hPanel)

1. **VPS plan.** In hPanel go to **VPS** and confirm you have a KVM VPS. Shared hosting cannot run this stack.
2. **Operating system.** Choose **Ubuntu 24.04** (or a template that includes **Docker**). Set a strong root password and add your SSH key if you can.
3. **Note the VPS IPv4 address.** You will use it in Step 2.
4. **Firewall.** In the VPS firewall settings allow TCP **22** (SSH), **80** and **443**. Do not open 5432.

## Step 2: DNS for `dev.loklens.com` (you do this where the domain's DNS is managed)

Create one record:

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `dev` | the VPS IPv4 address | default |

Wait for it to resolve (`nslookup dev.loklens.com` should show the VPS IP). Caddy needs this before it can issue the HTTPS certificate.

## Step 3: Install Docker and Node on the VPS (SSH as root)

```bash
apt update && apt install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sh
# Node 22 LTS (the project requires 22.23.4 or newer 22.x, or 24.22.1+)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
docker --version && node --version && npm --version
```

## Step 4: Get the code and create the secrets file

```bash
mkdir -p /opt/loklens && cd /opt/loklens
git clone -b develop https://github.com/harish461/loklens.git dev
cd dev
cp .env.example apps/web/.env
nano apps/web/.env
```

Fill in `apps/web/.env` on the server. Values you must create (never paste them into GitHub or chat):

- `DATABASE_URL=postgres://<user>:<password>@localhost:5432/<db>` (for the host build and migrations)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT=5432` (used by the database container)
- `SITE_HOST=dev.loklens.com`
- `NEXT_PUBLIC_SITE_URL=https://dev.loklens.com`
- `PAYLOAD_SECRET`, `PREVIEW_SECRET`, `REVALIDATE_SECRET`: each one a new random value, for example `openssl rand -hex 32`
- Cloudflare variables: leave empty unless you set up Cloudflare for this domain.

Use new secrets for the development server. Do not copy them from your local `.env`.

Also add `SITE_HOST=dev.loklens.com` to that file (it is read by Caddy and must be set there).

Protect the file: `chmod 600 apps/web/.env`.

## Step 5: Deploy

```bash
cd /opt/loklens/dev
bash infra/server/deploy-dev.sh
```

The script: pulls `develop`, installs packages, starts the database, runs migrations, builds the site on the host, then builds and starts the app and Caddy.

## Step 6: First admin account

The first user created in the admin becomes the admin (see `firstUserIsAdmin` in `Users.ts`). Open `https://dev.loklens.com/admin` and create it. Do this before anyone else can reach the site.

## Checklist before reporting "deployed"

- [ ] `https://dev.loklens.com` loads with a valid HTTPS certificate.
- [ ] Home page, a category page, an article page and `/search?q=…` all work.
- [ ] `https://dev.loklens.com/admin` login works; the dashboard loads.
- [ ] Create, edit and delete a test article; upload an image; check it displays.
- [ ] `https://dev.loklens.com/api/articles` returns JSON.
- [ ] `docker compose ps` shows `db` healthy and `app`, `caddy` running.
- [ ] The site is not reachable on port 5432 from outside.
- [ ] No production data was touched (the dev database is separate).

## Known gaps (to decide before production)

- **Build needs the database.** The pages are pre-generated from the database, so the deploy script migrates and builds on the host before starting containers. Every deploy needs the database up.
- **Backups.** Nightly `pg_dump` and a copy of the `media` volume are not set up yet.
- **Cloudflare** is optional here. Without it, pages are served directly by Caddy (no CDN cache).
- **Staging login protection** (basic auth or noindex) is not configured yet.
- **Environment label.** Robots should be set to `noindex` on the development domain before real traffic reaches it.
