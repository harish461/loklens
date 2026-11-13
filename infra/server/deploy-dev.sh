#!/usr/bin/env bash
# Deploys the development server from the `develop` branch.
# Order matters: the database needs its migrations before the build (pages read the database while they are
# generated), and the image is built only after the build succeeds. Production gets its own script later.
set -euo pipefail

REPO="${REPO:-/opt/loklens/dev}" # clone of the GitHub repository on the server
COMPOSE=(docker compose -f infra/server/docker-compose.server.yml --env-file apps/web/.env)

cd "$REPO"
git fetch origin develop
git checkout develop
git pull --ff-only origin develop

(cd apps/web && npm ci)
"${COMPOSE[@]}" up -d --wait db # Postgres up and healthy
(cd apps/web && npm run migrate) # schema changes only through migrations, never `push`
(cd apps/web && npm run build)   # static pages read the database, so this runs after migrate
"${COMPOSE[@]}" up -d --build app caddy
"${COMPOSE[@]}" ps
