import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { order } from "@/db/schema";
import { advanceOrder, getOrderWithItems, nextStatus } from "@/lib/orders";
import { syncStripePayment, stripeEnabled } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minutes a demo order sits in each state before the auto-pilot moves it on. */
const AUTO_ADVANCE_MINUTES: Record<string, number> = {
  new: 0.5,
  accepted: 1.5,
  preparing: 3,
  ready: 2,
  dispatched: 3,
};

function lastTransitionAt(o: typeof order.$inferSelect) {
  if (o.status === "new") return o.placedAt;
  if (o.status === "accepted") return o.acceptedAt ?? o.placedAt;
  if (o.status === "ready" || o.status === "dispatched")
    return o.readyAt ?? o.placedAt;
  return o.acceptedAt ?? o.placedAt;
}

/**
 * Tracker polling endpoint. Also runs the demo auto-pilot: an order left alone
 * walks itself through the kitchen so a client watching the tracker sees it
 * move without anyone touching the KDS.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (stripeEnabled()) await syncStripePayment(orderId);

  let current = await getOrderWithItems(orderId);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const waitMinutes = AUTO_ADVANCE_MINUTES[current.status];
  if (waitMinutes && current.paymentStatus !== "pending") {
    const since = Date.now() - lastTransitionAt(current).getTime();
    if (since > waitMinutes * 60_000 && nextStatus(current.status, current.type)) {
      await advanceOrder(orderId);
      current = await getOrderWithItems(orderId);
    }
  }

  return NextResponse.json(current);
}

/**
 * Advances one step. The order id acts as the capability here so the customer's
 * own "Simulate next step" demo control works without a staff login; the KDS
 * uses the authenticated /api/staff/orders endpoint instead.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orderId = Number(id);
  const body = await request.json().catch(() => ({}));

  const [exists] = await db.select().from(order).where(eq(order.id, orderId));
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await advanceOrder(orderId, body.status);
  return NextResponse.json(await getOrderWithItems(orderId));
}
