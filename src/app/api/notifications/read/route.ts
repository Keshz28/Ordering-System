import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { currentCustomer } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(eq(notification.customerId, customer.id), isNull(notification.readAt)),
    );

  return NextResponse.json({ ok: true });
}
