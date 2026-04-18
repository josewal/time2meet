#!/usr/bin/env bash
set -euo pipefail

DB="${TURSO_DB:-w2mb-prod}"

if ! command -v turso > /dev/null 2>&1; then
  echo "turso CLI not found. Install: curl -sSfL https://get.tur.so/install.sh | bash" >&2
  exit 1
fi

echo "minting short-lived token for $DB..."
export DB_URL="$(turso db show "$DB" --url)"
export DB_AUTH_TOKEN="$(turso db tokens create "$DB" --expiration 10m)"

npm run migrate
