import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  const envPath = resolve(repoRoot, ".dev.vars");
  let envContents: string;
  try {
    envContents = readFileSync(envPath, "utf8");
  } catch {
    console.error(`Failed to read ${envPath}`);
    process.exit(1);
  }
  const env = parseEnv(envContents);
  const url = env.DB_URL;
  const authToken = env.DB_AUTH_TOKEN;
  if (!url || !authToken) {
    console.error("Missing DB_URL or DB_AUTH_TOKEN in .dev.vars");
    process.exit(1);
  }

  const schemaPath = resolve(repoRoot, "src/db/schema.sql");
  const schema = readFileSync(schemaPath, "utf8");
  const statements = splitStatements(schema);

  const client = createClient({ url, authToken });

  let failed = false;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]!;
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    console.log(`[${i + 1}/${statements.length}] ${preview}`);
    try {
      await client.execute(stmt);
      console.log("  ok");
    } catch (err) {
      console.error("  failed:", err instanceof Error ? err.message : err);
      failed = true;
      break;
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
