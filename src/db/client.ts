import { createClient, type Client } from "@tursodatabase/serverless/compat";
import type { Env } from "../env";

export type DB = Client;

export function createDB(env: Env): DB {
  return createClient({ url: env.DB_URL, authToken: env.DB_AUTH_TOKEN });
}
