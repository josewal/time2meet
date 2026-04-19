import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Apply src/db/schema.sql to the libSQL DB at $DB_URL.
//
// Reads $DB_URL and $DB_AUTH_TOKEN from process.env. Falls back to
// .dev.vars in the repo root, so `npm run migrate` works after a
// fresh checkout with the example config copied in.
//
// For preview/production, use scripts/migrate.sh — it mints a
// short-lived token via the turso CLI and exports it before calling
// this script.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function parseEnv(contents: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main(): Promise<void> {
  let url = process.env.DB_URL;
  let authToken = process.env.DB_AUTH_TOKEN;
  let source = "process.env";

  if (!url || !authToken) {
    const envPath = resolve(repoRoot, ".dev.vars");
    try {
      const fileEnv = parseEnv(readFileSync(envPath, "utf8"));
      url = url || fileEnv.DB_URL;
      authToken = authToken || fileEnv.DB_AUTH_TOKEN;
      source = ".dev.vars";
    } catch {
      // fall through to the missing-vars error below
    }
  }

  if (!url || !authToken) {
    console.error(
      "Missing DB_URL or DB_AUTH_TOKEN. Set them in process.env or .dev.vars.",
    );
    process.exit(1);
  }

  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  console.log(`migrating ${host} (source: ${source})`);

  const schemaPath = resolve(repoRoot, "src/db/schema.sql");
  const statements = splitStatements(readFileSync(schemaPath, "utf8"));

  const client = createClient({ url, authToken });

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]!;
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    console.log(`[${i + 1}/${statements.length}] ${preview}`);
    try {
      await client.execute(stmt);
      console.log("  ok");
    } catch (err) {
      console.error("  failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
