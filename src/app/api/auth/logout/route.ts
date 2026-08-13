import { NextResponse } from "next/server";
import { clearCustomerSession, clearStaffSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { scope } = await request.json().catch(() => ({ scope: "customer" }));
  if (scope === "staff") await clearStaffSession();
  else await clearCustomerSession();
  return NextResponse.json({ ok: true });
}
