#!/usr/bin/env bash
set -euo pipefail

# One-command local dev:
#   - starts a local libSQL server (turso dev) on 127.0.0.1:8080
#   - applies schema (idempotent)
#   - runs `wrangler dev` against it
#
# Requires: turso CLI (one-time: curl -sSfL https://get.tur.so/install.sh | bash)

cd "$(dirname "$0")/.."

if ! command -v turso > /dev/null 2>&1; then
  echo "turso CLI not found. Install once:" >&2
  echo "  curl -sSfL https://get.tur.so/install.sh | bash" >&2
  exit 1
fi

if [ ! -f .dev.vars ]; then
  echo "no .dev.vars — copying from .dev.vars.example"
  cp .dev.vars.example .dev.vars
fi

mkdir -p .data
TURSO_PORT="${TURSO_PORT:-8080}"
TURSO_URL="http://127.0.0.1:${TURSO_PORT}"

started_turso=0
if ! curl -sf "$TURSO_URL" > /dev/null 2>&1; then
  echo "starting turso dev on $TURSO_URL ..."
  nohup turso dev --port "$TURSO_PORT" --db-file .data/local.db \
    > .data/turso.log 2>&1 &
  echo $! > .data/turso.pid
  started_turso=1
  for _ in $(seq 1 20); do
    if curl -sf "$TURSO_URL" > /dev/null 2>&1; then break; fi
    sleep 0.5
  done
fi

cleanup() {
  if [ "$started_turso" = "1" ] && [ -f .data/turso.pid ]; then
    kill "$(cat .data/turso.pid)" 2>/dev/null || true
    rm -f .data/turso.pid
  fi
}
trap cleanup EXIT

DB_URL="$TURSO_URL" DB_AUTH_TOKEN=dev npx tsx scripts/migrate.ts > /dev/null

# Foreground (not exec) so the EXIT trap above can clean up turso dev.
npx wrangler dev "$@"
