#!/bin/sh
set -e
cd /app

if [ -z "$DATABASE_URL" ]; then
  echo "entrypoint: ERROR — DATABASE_URL is not set. Migrations and the app require it." >&2
  exit 1
fi

echo "entrypoint: running database migrations…"
pnpm exec drizzle-kit migrate

echo "entrypoint: starting Nitro…"
cd /app/.output
exec node server/index.mjs
