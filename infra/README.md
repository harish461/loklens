# infra/

Infrastructure for LokLens News (owned by the devops agent).

| File | Purpose |
|---|---|
| `docker-compose.dev.yml` | Local development only: PostgreSQL 16 + optional Adminer |

Production/staging files (production compose, Caddyfile, backup scripts, CI workflows, deploy guide)
are added in a later task. The dev compose file is **never** used on a server.

## Local database

Prerequisite: Docker Desktop (Windows: WSL2 backend enabled) running.

```bash
npm run db:up      # start Postgres on 127.0.0.1:5432, waits until healthy
npm run db:logs    # follow logs (Ctrl+C to stop following)
npm run db:down    # stop; data is kept in the named volume "loklens-dev_pgdata"
```

Defaults: user `loklens`, password `loklens`, database `loklens`, port `5432`, which matches
`DATABASE_URL` in `.env.example`:

```
DATABASE_URL=postgres://loklens:loklens@localhost:5432/loklens
```

Override with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` or `POSTGRES_PORT` set in your shell
(for example if port 5432 is already used by a local Postgres install), and update `DATABASE_URL` to match.
Only change credentials on a fresh volume: Postgres applies them only when the volume is first created.

### Adminer (optional DB browser)

```bash
docker compose -f infra/docker-compose.dev.yml --profile tools up -d
```

Open http://localhost:8080, system "PostgreSQL", server `db`, and the credentials above.

### Reset the database

This deletes all local data (articles, users, everything in the dev DB):

```bash
docker compose -f infra/docker-compose.dev.yml --profile tools down -v
npm run db:up
```

Both ports are bound to `127.0.0.1`, so the database is not reachable from other machines on your network.
