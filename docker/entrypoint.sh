#!/bin/sh
set -e
cd /app

if [ -z "$DATABASE_URL" ]; then
  echo "entrypoint: ERROR — DATABASE_URL is not set. Migrations and the app require it." >&2
  exit 1
fi

echo "entrypoint: running database migrations…"
pnpm exec drizzle-kit migrate

WORKER_PID=""

stop_worker() {
  if [ -n "$WORKER_PID" ]; then
    kill "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
    WORKER_PID=""
  fi
}

start_worker() {
  if [ "${RUN_QUOTE_WORKER:-true}" != "true" ]; then
    echo "entrypoint: quote worker disabled (RUN_QUOTE_WORKER=false)"
    return
  fi
  if [ ! -f /app/.output/worker/quote-worker.mjs ]; then
    echo "entrypoint: ERROR — worker bundle missing at .output/worker/quote-worker.mjs" >&2
    exit 1
  fi
  echo "entrypoint: starting quote worker…"
  node /app/.output/worker/quote-worker.mjs &
  WORKER_PID=$!
}

trap 'stop_worker; exit 143' TERM
trap 'stop_worker; exit 130' INT

start_worker

echo "entrypoint: starting Nitro…"
cd /app/.output
node server/index.mjs &
WEB_PID=$!

wait "$WEB_PID"
EXIT=$?
stop_worker
exit "$EXIT"
