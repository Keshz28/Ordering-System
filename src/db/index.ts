import { createClient, type Config } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * One Drizzle client for both environments.
 *
 * Local dev  -> `file:./.data/db.sqlite`
 * Production -> Turso (libSQL over HTTP), which is the only way to keep the
 *               SQLite dialect on Vercel: serverless functions have an
 *               ephemeral read-only filesystem, so a committed .sqlite file
 *               silently loses every write.
 */
/** Treats blank env vars as unset — .env.example ships the keys empty, and
 *  hosting dashboards happily store "" for a variable you never filled in. */
function env(name: string) {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function resolveConfig(): Config {
  const url = env("TURSO_DATABASE_URL") ?? env("DB_STORAGE_URL");
  const authToken = env("TURSO_AUTH_TOKEN");

  if (url && !url.startsWith("file:")) {
    return { url, authToken };
  }
  return { url: url ?? "file:./.data/db.sqlite" };
}

const globalForDb = globalThis as unknown as {
  __bellaCucinaDb?: ReturnType<typeof drizzle<typeof schema>>;
};

export const db =
  globalForDb.__bellaCucinaDb ??
  drizzle(createClient(resolveConfig()), { schema });

if (process.env.NODE_ENV !== "production") globalForDb.__bellaCucinaDb = db;

export { schema };
export * from "./schema";
