#!/usr/bin/env bash
set -euo pipefail

URL="${APP_URL:-${DEPLOY_URL:-}}"
if [ -z "$URL" ]; then
  echo "no APP_URL or DEPLOY_URL set" >&2
  exit 1
fi
URL="${URL%/}"

echo "smoke-testing $URL"

tries=10
for i in $(seq 1 $tries); do
  status=$(curl -s -o /tmp/smoke.html -w '%{http_code}' "$URL/") || status=000
  if [ "$status" = "200" ] && grep -q "when2meet-better" /tmp/smoke.html; then
    echo "GET / ok"
    break
  fi
  if [ "$i" = "$tries" ]; then
    echo "GET / failed after $tries tries (last status: $status)" >&2
    head -c 2000 /tmp/smoke.html >&2 || true
    exit 1
  fi
  sleep 3
done

title="smoke-$(date +%s)-$RANDOM"
dates="$(python3 -c 'from datetime import date, timedelta; b=date.today()+timedelta(days=30); print(",".join((b+timedelta(days=i)).isoformat() for i in range(2)))')"

create_status=$(curl -s -o /tmp/create.out -w '%{http_code}' -D /tmp/create.headers \
  -X POST "$URL/events" \
  -d "title=$title" \
  -d "dates=$dates" \
  -d "startTime=09:00" \
  -d "endTime=10:00" \
  -d "slotMinutes=30")

if [ "$create_status" != "200" ]; then
  echo "POST /events failed: $create_status" >&2
  cat /tmp/create.out >&2 || true
  exit 1
fi

redirect=$(awk 'tolower($1)=="hx-redirect:" {print $2}' /tmp/create.headers | tr -d '\r')
if [ -z "$redirect" ]; then
  echo "no HX-Redirect header on POST /events response" >&2
  cat /tmp/create.headers >&2
  exit 1
fi

event_status=$(curl -s -o /dev/null -w '%{http_code}' "$URL$redirect")
if [ "$event_status" != "200" ]; then
  echo "GET $redirect failed: $event_status" >&2
  exit 1
fi

echo "smoke test passed: created $redirect"
