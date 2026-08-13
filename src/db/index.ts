import { createClient as createRemoteClient } from "@libsql/client/web";
import type { Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * One Drizzle client for both environments.
 *
 * Local dev  -> `file:./.data/db.sqlite` via the native client
 * Production -> Turso (libSQL) via the pure-HTTP `/web` client, which has no
 *               native binary and therefore nothing to go wrong in a
 *               serverless bundle.
 *
 * Serverless filesystems are ephemeral and read-only, so a file-backed
 * database can never work there — we fail loudly instead of silently falling
 * back to one, which is exactly the confusion this used to cause.
 */

/** Treats blank env vars as unset — .env.example ships the keys empty, and
 *  hosting dashboards happily store "" for a variable you never filled in. */
function env(name: string) {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export type DbResolution = {
  driver: "turso" | "file";
  /** Host only — never the token or the full connection string. */
  host: string | null;
  hasAuthToken: boolean;
  /** Which env var supplied the URL, for debugging a deployment. */
  urlSource: string | null;
  isServerless: boolean;
  warning: string | null;
};

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_REGION);

function resolve(): { client: Client; resolution: DbResolution } {
  const url = env("TURSO_DATABASE_URL") ?? env("DB_STORAGE_URL");
  const urlSource = env("TURSO_DATABASE_URL")
    ? "TURSO_DATABASE_URL"
    : env("DB_STORAGE_URL")
      ? "DB_STORAGE_URL"
      : null;
  const authToken = env("TURSO_AUTH_TOKEN");

  if (url && !url.startsWith("file:")) {
    let host: string | null = null;
    try {
      host = new URL(url.replace(/^libsql:/, "https:")).host;
    } catch {
      host = "unparseable";
    }
    return {
      client: createRemoteClient({ url, authToken }),
      resolution: {
        driver: "turso",
        host,
        hasAuthToken: Boolean(authToken),
        urlSource,
        isServerless,
        warning: authToken
          ? null
          : "TURSO_AUTH_TOKEN is missing — Turso will reject every query.",
      },
    };
  }

  if (isServerless) {
    throw new Error(
      "No TURSO_DATABASE_URL is set. A serverless deployment cannot use a " +
        "file-backed SQLite database because the filesystem is ephemeral and " +
        "read-only. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the " +
        "project's environment variables and redeploy.",
    );
  }

  // Local development only. Required lazily so the native binary is never
  // pulled into a serverless bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
  const fileUrl = url ?? "file:./.data/db.sqlite";
  return {
    client: createClient({ url: fileUrl }),
    resolution: {
      driver: "file",
      host: fileUrl,
      hasAuthToken: false,
      urlSource,
      isServerless,
      warning: null,
    },
  };
}

const globalForDb = globalThis as unknown as {
  __bellaCucinaDb?: ReturnType<typeof drizzle<typeof schema>>;
  __bellaCucinaResolution?: DbResolution;
};

let resolution: DbResolution;
let dbInstance: ReturnType<typeof drizzle<typeof schema>>;

if (globalForDb.__bellaCucinaDb && globalForDb.__bellaCucinaResolution) {
  dbInstance = globalForDb.__bellaCucinaDb;
  resolution = globalForDb.__bellaCucinaResolution;
} else {
  const resolved = resolve();
  resolution = resolved.resolution;
  dbInstance = drizzle(resolved.client, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__bellaCucinaDb = dbInstance;
    globalForDb.__bellaCucinaResolution = resolution;
  }
}

export const db = dbInstance;

/** Connection facts for the health endpoint. Contains no secrets. */
export function dbDiagnostics(): DbResolution {
  return resolution;
}

export { schema };
export * from "./schema";
