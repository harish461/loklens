# LokLens News

Rebuild of loklensnews.com - Hindi news for Uttarakhand. Next.js + Payload CMS 3 + PostgreSQL.
See `CLAUDE.md` for the project brief and `docs/` for the audit, architecture and API contract.

## Local development

### Prerequisites

- Node.js 22 or newer (`.nvmrc` pins 22; Node 24 also works locally)
- Docker Desktop with the WSL2 backend (Windows) - used only for the local PostgreSQL database

### Steps

```bash
# 1. Environment: Next.js/Payload read .env from the app folder
cp .env.example apps/web/.env
#    then set PAYLOAD_SECRET (and the other secrets) to random values:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Install dependencies (npm workspaces, run from the repo root)
npm install

# 3. Start PostgreSQL 16 in Docker (127.0.0.1:5432)
npm run db:up

# 4. Start the app
npm run dev
```

Open http://localhost:3000 for the site and http://localhost:3000/admin for the Payload admin
(the first visit asks you to create the first admin user).

Other scripts: `npm run build`, `npm run start`, `npm run lint`, `npm run typecheck`, `npm run test`,
`npm run db:logs`, `npm run db:down`. More on the database (Adminer, reset) in `infra/README.md`.

Staging/production deployment files and docs come in a later task.
