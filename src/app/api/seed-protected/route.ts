import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { menuItem } from "@/db/schema";

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

  try {
    const [row] = await db.select({ n: count() }).from(menuItem);
    return NextResponse.json({
      status: "ready",
      menuItems: row?.n ?? 0,
      seeded: (row?.n ?? 0) > 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "no_schema",
        error: error instanceof Error ? error.message : "Unknown error",
        hint: "Run `npm run db:push` against this database before seeding.",
      },
      { status: 500 },
    );
  }
}
