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

## Working in a git worktree

`.dev.vars` is gitignored and lives only at the main checkout. When creating a new worktree (e.g. under `.claude/worktrees/`), copy it over before running `npm run dev` or `npm run test:e2e`:

```bash
cp ../../../.dev.vars .dev.vars   # adjust relative path to the main checkout
```

If `.dev.vars` points at a local sqld (e.g. `http://127.0.0.1:8080`), make sure sqld is running from the main checkout's `.data/` directory:

```bash
# from the main checkout, once per machine session
sqld -d .data --http-listen-addr 127.0.0.1:8080
```

All worktrees then share that single DB.

## Deploy

```bash
wrangler login
wrangler secret put DB_URL
wrangler secret put DB_AUTH_TOKEN
wrangler secret put COOKIE_SECRET
npm run deploy
```

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
