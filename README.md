# when2meet-better

A minimal, open-source when2meet clone running on Cloudflare Workers + Turso. No login required, URL-as-identity. Dynamically-rendered OG image so Slack unfurls the live availability heatmap.

## Stack

- Runtime: Cloudflare Workers
- Framework: Hono
- DB: Turso / libSQL via `@tursodatabase/serverless/compat`
- Frontend: vanilla JS (drag-select grid) + HTMX
- OG image: `workers-og`

## Features

- URL-based events, no login
- Drag-to-select availability grid (mouse + touch)
- Live heatmap results
- Slack URL unfurl with dynamic OG image — zero Slack app install
- Free to host on Cloudflare Workers free tier + Turso free tier

## Quick start (local dev)

Install deps and the turso CLI:

```bash
npm install
# one-time: curl -sSfL https://get.tur.so/install.sh | bash
```

Start a local libSQL server (no account, no real DB needed):

```bash
mkdir -p .data
turso dev --db-file .data/local.db
```

In another terminal, create `.dev.vars` at the project root. These values
are local-only — not real secrets:

```
DB_URL=http://127.0.0.1:8080
DB_AUTH_TOKEN=dev
COOKIE_SECRET=<random 32+ byte string>
```

Generate a COOKIE_SECRET:

```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

Apply schema and run the Worker:

```bash
npm run migrate
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

One-time setup:

```bash
wrangler login
wrangler secret put DB_URL
wrangler secret put DB_AUTH_TOKEN
wrangler secret put COOKIE_SECRET
```

Manual deploy (no secrets on disk — `migrate:prod` mints a short-lived
10-minute Turso token via the `turso` CLI):

```bash
turso auth login            # one-time
npm run migrate:prod        # scripts/migrate-prod.sh
npm run deploy
```

Override the DB name if it's not `w2mb-prod`:

```bash
TURSO_DB=my-db npm run migrate:prod
```

### Automated deploys (Cloudflare Workers Builds)

Deploys are handled directly by Cloudflare — no GitHub Actions tokens
required. One-time setup:

1. Cloudflare dashboard → Workers & Pages → `when2meet-better` → Settings → Builds
2. Connect the GitHub repo, branch `main`
3. Build command: `npm ci`, deploy command: `npx wrangler deploy`

Every push to `main` triggers a Cloudflare-side build + deploy. Secrets
already set via `wrangler secret put` apply. No GH repo secrets needed.

`.github/workflows/ci.yml` runs typecheck + e2e on pushes and PRs as a
signal layer; it does not deploy.

Prod DB migrations are run manually — `npm run migrate:prod` from your
laptop before pushing any schema-changing commit. Keeps the Turso token
off GitHub's and Cloudflare's build envs.

After a deploy, verify with `bash scripts/smoke.sh` pointing at the
deployed URL:

```bash
APP_URL=https://when2meet-better.<subdomain>.workers.dev bash scripts/smoke.sh
```

## Project layout

```
src/
  index.ts        # Hono app
  env.ts
  db/             # schema + client + queries
  routes/         # pages, identify, cells, results, admin, og
  views/          # HTML template functions
  lib/            # cookies, ids, slots, heatmap
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

## Identity model

Names are open: anyone who enters the same name edits the same row. No passwords, no logout — identity is just the name the user typed. The event creator holds an admin token (cookie) and can delete a participant row if needed.

## Known v1 limitations

- No timezones (displayed as entered, like when2meet).
- No real-time updates; results panel polls every 5s.
- Single-participant concurrent edits from two tabs: last-writer-wins.
- Dates are picked via comma-separated YYYY-MM-DD strings in v1. A real date picker UI is future work.

## License

MIT — see LICENSE.
