#!/usr/bin/env bash
set -euo pipefail

# Migrate a remote Turso DB. Mints a 10-minute token via the turso CLI
# so no long-lived credentials ever touch disk.
#
# Usage:
#   bash scripts/migrate.sh preview
#   bash scripts/migrate.sh production
#
# The Turso DB name is derived as `time2meet-<env>` unless overridden
# via $TURSO_DB.

cd "$(dirname "$0")/.."

ENV_NAME="${1:-}"
case "$ENV_NAME" in
  preview|production) ;;
  *)
    echo "Usage: $0 preview|production" >&2
    exit 1
    ;;
esac

DB="${TURSO_DB:-time2meet-$ENV_NAME}"

if ! command -v turso > /dev/null 2>&1; then
  echo "turso CLI not found. Install once:" >&2
  echo "  curl -sSfL https://get.tur.so/install.sh | bash" >&2
  exit 1
fi

echo "minting 10m token for $DB ..."
export DB_URL="$(turso db show "$DB" --url)"
export DB_AUTH_TOKEN="$(turso db tokens create "$DB" --expiration 10m)"

npx tsx scripts/migrate.ts
