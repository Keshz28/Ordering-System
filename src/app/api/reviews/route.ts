import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { order, pointsLedger, review } from "@/db/schema";
import { currentCustomer, staffGuard, logActivity } from "@/lib/auth";
import { recomputeLoyalty } from "@/lib/loyalty";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

const createSchema = z.object({
  orderId: z.number(),
  rating: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

const REVIEW_POINTS = 20;

export async function POST(request: Request) {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Sign in to review." }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review." }, { status: 400 });
  }

  const [target] = await db
    .select()
    .from(order)
    .where(
      and(eq(order.id, parsed.data.orderId), eq(order.customerId, customer.id)),
    );
  if (!target) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(review)
    .where(eq(review.orderId, target.id));
  if (existing) {
    return NextResponse.json(
      { error: "You've already reviewed this order." },
      { status: 409 },
    );
  }

  await db.insert(review).values({
    orderId: target.id,
    customerId: customer.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  });

  // Review solicitation reward — credited immediately, not pending.
  await db.insert(pointsLedger).values({
    customerId: customer.id,
    points: REVIEW_POINTS,
    state: "active",
    reason: "review",
    expiresAt: new Date(Date.now() + 18 * 30 * 86_400_000),
  });
  await recomputeLoyalty(customer.id);

  await notify({
    customerId: customer.id,
    kind: "loyalty",
    title: `${REVIEW_POINTS} points for your review`,
    message: `Thanks for reviewing ${target.number}. Your points are already available.`,
    href: "/account/rewards",
  });

  return NextResponse.json({ ok: true, points: REVIEW_POINTS });
}

/** Staff reply to a review. */
export async function PATCH(request: Request) {
  const staff = await staffGuard("admin");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const id = Number(body.id);
  const reply = String(body.reply ?? "").trim();
  if (!id || !reply) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const [target] = await db.select().from(review).where(eq(review.id, id));
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(review)
    .set({ reply, repliedAt: new Date() })
    .where(eq(review.id, id));

  if (target.customerId) {
    await notify({
      customerId: target.customerId,
      kind: "system",
      title: "Bella Cucina replied to your review",
      message: reply,
      href: "/account",
    });
  }

  await logActivity("Replied to review", `Review #${id}`);
  return NextResponse.json({ ok: true });
}
