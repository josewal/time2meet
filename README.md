# time2meet

A minimal, open-source [when2meet](https://when2meet.com) clone on Cloudflare Workers + Turso. No login. URL-as-identity. Slack unfurls render the live availability heatmap as an OG image.

## Stack

- Runtime: Cloudflare Workers
- Framework: Hono
- DB: Turso / libSQL via `@libsql/client`
- Frontend: vanilla JS (drag-select grid) + HTMX
- OG image: `workers-og`

## Environments

| Name         | Worker name         | Turso DB              | Where secrets live          |
| ------------ | ------------------- | --------------------- | --------------------------- |
| `local`      | `time2meet-local`   | local sqld via `turso dev` | `.dev.vars` (gitignored) |
| `preview`    | `time2meet-preview` | `time2meet-preview`   | Cloudflare dashboard        |
| `production` | `time2meet`         | `time2meet-production`| Cloudflare dashboard        |

## Local dev

One-time:

```bash
npm install
curl -sSfL https://get.tur.so/install.sh | bash   # turso CLI, only for the local libSQL server
```

Run:

```bash
npm run dev
```

That single command starts a local libSQL server (`turso dev`), applies the schema, and runs `wrangler dev` at <http://localhost:8787>. On first run it copies `.dev.vars.example` to `.dev.vars`. Both files contain only fake local-only values.

## Deploy

Both environments deploy automatically through **Cloudflare Workers Builds** — no GitHub secrets, no `wrangler deploy` from your laptop:

- Push to `main` → `time2meet` (production)
- Push to any other branch / PR → `time2meet-preview`

One-time setup (Cloudflare dashboard → Workers & Pages → time2meet → Settings → Builds):

1. Connect this GitHub repo
2. Build command: `npm ci`
3. Deploy command: `npx wrangler deploy --env production` for `main`, `npx wrangler deploy --env preview` for other branches
4. Add per-environment variables: `DB_URL`, `DB_AUTH_TOKEN`, `COOKIE_SECRET`

Generate a `COOKIE_SECRET`:

```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

## DB migrations

Migrations are manual and idempotent (`CREATE TABLE IF NOT EXISTS`). Run from your laptop before pushing any schema-changing commit:

```bash
turso auth login                # one-time
npm run migrate:preview         # mints a 10m token, applies src/db/schema.sql
npm run migrate:production
```

`scripts/migrate.sh` mints a 10-minute Turso token via the `turso` CLI and discards it. No long-lived prod credentials ever touch disk.

## CI

- `.github/workflows/ci.yml` — typecheck + Playwright e2e on every push/PR. Spins up `turso dev` locally; never touches a real DB.
- `.github/workflows/smoke.yml` — after every push to `main` (waits 60s for Workers Builds) and hourly on a schedule, runs `scripts/smoke.sh` against the live URL in `vars.APP_URL`. Catches "deployed but broken" within an hour.

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
public/           # static assets
scripts/
  dev.sh          # local bootstrap: turso dev + migrate + wrangler dev
  migrate.sh      # apply schema to preview/production via turso CLI
  migrate.ts      # the actual migrator (reads $DB_URL / $DB_AUTH_TOKEN)
  smoke.sh        # GET / + POST /events check against a deployed URL
```

## How Slack unfurl works

The event page injects OG meta tags including an `og:image` URL with a `?v=<updated_at>` cache-buster. Slack fetches that image; the Worker renders a PNG of the current heatmap on demand and caches it in the Workers Cache keyed by `updated_at`. Votes bump `updated_at`, which yields a new image URL, so Slack re-unfurls a fresh heatmap.

## Identity model

Names are open: anyone who enters the same name edits the same row. No passwords. The event creator holds an admin token (cookie) and can delete a participant row.

## Known v1 limitations

- No timezones (displayed as entered, like when2meet)
- No real-time updates; results panel polls every 5s
- Concurrent edits from two tabs of the same name: last-writer-wins

## License

MIT — see LICENSE.
