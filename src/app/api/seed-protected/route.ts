import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { db, dbDiagnostics } from "@/db";
import { menuItem } from "@/db/schema";

/** Unwraps the driver error Drizzle hides behind "Failed query: …". */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth++) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(" ← ");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Seeds a deployed instance once, so the production database has the same rich
 * demo data as local dev.
 *
 *   curl -X POST https://<app>.vercel.app/api/seed-protected \
 *     -H "Authorization: Bearer $ADMIN_SEED_TOKEN"
 *
 * Refuses to run unless ADMIN_SEED_TOKEN is set, so an unconfigured deployment
 * can never have its data wiped by a passer-by.
 */
function authorize(request: Request) {
  const expected = process.env.ADMIN_SEED_TOKEN?.trim();
  if (!expected) {
    return {
      ok: false as const,
      status: 503,
      error:
        "Seeding is disabled: set ADMIN_SEED_TOKEN in the environment first.",
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  const queryToken = new URL(request.url).searchParams.get("token")?.trim();
  const supplied = bearer || queryToken;

  if (!supplied || supplied !== expected) {
    return { ok: false as const, status: 401, error: "Invalid seed token." };
  }
  return { ok: true as const };
}

export async function POST(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const started = Date.now();
  try {
    // Imported lazily so the seed module (and its dev dependencies) never gets
    // pulled into the normal request path.
    const { seed } = await import("@/db/seed");
    const counts = await seed();
    return NextResponse.json({
      status: "seeded",
      elapsedMs: Date.now() - started,
      ...counts,
    });
  } catch (error) {
    console.error("[seed-protected] failed", error);
    return NextResponse.json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        hint: "Check that the database schema has been pushed (npm run db:push against the same TURSO_DATABASE_URL).",
      },
      { status: 500 },
    );
  }
}

/** Health check — confirms the token works and reports whether data exists. */
export async function GET(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Reported on both paths so a failing deployment is diagnosable in one call.
  const connection = dbDiagnostics();
  const envPresence = {
    TURSO_DATABASE_URL: Boolean(process.env.TURSO_DATABASE_URL?.trim()),
    TURSO_AUTH_TOKEN: Boolean(process.env.TURSO_AUTH_TOKEN?.trim()),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET?.trim()),
    ADMIN_SEED_TOKEN: Boolean(process.env.ADMIN_SEED_TOKEN?.trim()),
    NEXTAUTH_URL: Boolean(process.env.NEXTAUTH_URL?.trim()),
  };

  try {
    const [row] = await db.select({ n: count() }).from(menuItem);
    return NextResponse.json({
      status: "ready",
      menuItems: row?.n ?? 0,
      seeded: (row?.n ?? 0) > 0,
      connection,
      envPresence,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "query_failed",
        error: describeError(error),
        connection,
        envPresence,
        hint:
          connection.driver === "file"
            ? "The app fell back to a local file database, which cannot work on Vercel. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN, then redeploy."
            : !connection.hasAuthToken
              ? "Connected to Turso but no auth token was supplied — set TURSO_AUTH_TOKEN and redeploy."
              : "Reached Turso but the query failed. Confirm the schema was pushed to this exact database (npm run db:push).",
      },
      { status: 500 },
    );
  }
}
