import { NextResponse } from "next/server";
import { getBranchBySlug, setBranchCookie } from "@/lib/branches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sets which outlet the storefront orders from. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    branch?: string;
  } | null;
  const slug = body?.branch?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Branch required." }, { status: 400 });
  }

  const found = await getBranchBySlug(slug);
  if (!found || !found.active) {
    return NextResponse.json({ error: "Unknown branch." }, { status: 404 });
  }

  await setBranchCookie(found.slug);
  return NextResponse.json({ ok: true, branch: found.slug });
}
