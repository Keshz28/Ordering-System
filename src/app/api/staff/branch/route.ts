import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/session";
import { setStaffBranchCookie } from "@/lib/branches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Switches which outlet a staff member is viewing.
 *
 * Refused for accounts tied to a branch — a Setapak cashier cannot talk their
 * way into Bangsar's tickets by posting a different slug.
 */
export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (session.branchId) {
    return NextResponse.json(
      { error: "Your account is tied to a single branch." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    branch?: string;
  } | null;
  const slug = body?.branch?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Branch required." }, { status: 400 });
  }

  await setStaffBranchCookie(slug);
  return NextResponse.json({ ok: true, branch: slug });
}
