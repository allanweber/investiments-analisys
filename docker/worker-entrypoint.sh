#!/bin/sh
set -e
cd /app

if [ -z "$DATABASE_URL" ]; then
  echo "worker-entrypoint: ERROR — DATABASE_URL is not set." >&2
  exit 1
fi

if [ ! -f /app/.output/worker/quote-worker.mjs ]; then
  echo "worker-entrypoint: ERROR — worker bundle missing at .output/worker/quote-worker.mjs" >&2
  exit 1
fi

echo "worker-entrypoint: starting quote worker…"
exec node /app/.output/worker/quote-worker.mjs
