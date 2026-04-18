# when2meet-better

A minimal, open-source when2meet clone running on Cloudflare Workers + Turso. No login required, URL-as-identity. Optional per-name password (like when2meet). Dynamically-rendered OG image so Slack unfurls the live availability heatmap.

## Stack

- Runtime: Cloudflare Workers
- Framework: Hono
- DB: Turso / libSQL via `@tursodatabase/serverless/compat`
- Frontend: vanilla JS (drag-select grid) + HTMX
- OG image: `workers-og`

## Features

- URL-based events, no login
- Optional per-name passwords (like when2meet)
- Drag-to-select availability grid (mouse + touch)
- Live heatmap results
- Slack URL unfurl with dynamic OG image — zero Slack app install
- Free to host on Cloudflare Workers free tier + Turso free tier

## Quick start (local dev)

```bash
npm install
```

Create a Turso DB:

```bash
# install turso CLI once: curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup     # or: turso auth login
turso db create w2mb-dev
turso db show w2mb-dev --url          # copy
turso db tokens create w2mb-dev       # copy
```

Create `.dev.vars` at the project root:

```
DB_URL=libsql://...
DB_AUTH_TOKEN=...
COOKIE_SECRET=<random 32+ byte string>
```

Generate a COOKIE_SECRET:

```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

Apply schema:

```bash
npm run migrate
```

Run locally:

```bash
npm run dev
```

Open http://localhost:8787

## Deploy

One-time setup:

```bash
wrangler login
wrangler secret put DB_URL
wrangler secret put DB_AUTH_TOKEN
wrangler secret put COOKIE_SECRET
```

Manual deploy:

```bash
npm run migrate:prod   # reads .prod.vars
npm run deploy
```

### Automated deploys (GitHub Actions)

- `.github/workflows/ci.yml` — on PR: typecheck + e2e (uses a local `turso dev`; no external DB)
- `.github/workflows/deploy.yml` — on push to `main`: migrate prod DB → deploy Worker → smoke test

Required repo **secrets**:

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with `Workers Scripts:Edit` + `Account:Read`
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `DB_URL` — Turso prod libSQL URL
- `DB_AUTH_TOKEN` — Turso prod auth token

Optional repo **variable**:

- `APP_URL` — public URL used by the smoke test (e.g. `https://when2meet.example.com`). If unset, falls back to the `workers.dev` URL returned by `wrangler deploy`.

## Project layout

```
src/
  index.ts        # Hono app
  env.ts
  db/             # schema + client + queries
  routes/         # pages, identify, cells, results, admin, og
  views/          # HTML template functions
  lib/            # password, cookies, ids, slots, heatmap
  fonts/          # embedded font for OG image
public/           # static assets served by Worker
  grid.js         # drag-select
  styles.css
  htmx.min.js
scripts/
  migrate.ts      # apply schema.sql to Turso
```

## How Slack unfurl works

The event page injects OG meta tags including an `og:image` URL with a `?v=<updated_at>` cache-buster. Slack fetches that image; the Worker renders a PNG of the current heatmap on demand and caches it in the Workers Cache keyed by `updated_at`. Votes bump `updated_at`, which yields a new image URL, so Slack re-unfurls a fresh heatmap.

## Password model

Mirrors when2meet exactly: name is required, password is optional. First person to claim a name can set (or skip) a password. If no password is set, the name is "open" — anyone can edit it (matching when2meet's behavior). With a password, only the password holder can edit. No recovery — the event creator holds an admin token (cookie) and can wipe a participant row so the user re-claims.

## Known v1 limitations

- No timezones (displayed as entered, like when2meet).
- No real-time updates; results panel polls every 5s.
- Single-participant concurrent edits from two tabs: last-writer-wins.
- Dates are picked via comma-separated YYYY-MM-DD strings in v1. A real date picker UI is future work.

## License

MIT — see LICENSE.
