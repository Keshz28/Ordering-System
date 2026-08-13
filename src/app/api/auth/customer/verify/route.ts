import { NextResponse } from "next/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customer, loginToken, notification } from "@/db/schema";
import { setCustomerSession } from "@/lib/session";
import { claimGuestOrders } from "@/lib/orders";
import { recomputeLoyalty, runPointsMaintenance } from "@/lib/loyalty";
import { recomputeCustomer } from "@/lib/segments";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
  name: z.string().optional(),
});

const MAX_ATTEMPTS = 6;

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const code = parsed.data.code.trim();

  const [token] = await db
    .select()
    .from(loginToken)
    .where(
      and(
        eq(loginToken.email, email),
        gt(loginToken.expiresAt, new Date()),
        isNull(loginToken.consumedAt),
      ),
    )
    .orderBy(desc(loginToken.createdAt))
    .limit(1);

  if (!token) {
    return NextResponse.json(
      { error: "That code has expired. Request a new one." },
      { status: 400 },
    );
  }

  if (token.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Request a fresh code." },
      { status: 429 },
    );
  }

  if (token.code !== code) {
    await db
      .update(loginToken)
      .set({ attempts: token.attempts + 1 })
      .where(eq(loginToken.id, token.id));
    return NextResponse.json(
      {
        error: `That code doesn't match. ${MAX_ATTEMPTS - token.attempts - 1} attempts left.`,
      },
      { status: 400 },
    );
  }

  await db
    .update(loginToken)
    .set({ consumedAt: new Date() })
    .where(eq(loginToken.id, token.id));

  // Find or create the customer record.
  let [record] = await db
    .select()
    .from(customer)
    .where(eq(customer.email, email));

  if (!record) {
    const fallbackName =
      parsed.data.name?.trim() ||
      email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    [record] = await db
      .insert(customer)
      .values({ name: fallbackName, email })
      .returning();
  }

  await setCustomerSession({
    id: record.id,
    name: record.name,
    email: record.email,
  });

  // Any guest-checkout orders on this email now belong to the account, and the
  // loyalty they would have earned is credited retroactively.
  const claimed = await claimGuestOrders(record);

  // Attach previously anonymous notifications (login codes, guest order updates).
  await db
    .update(notification)
    .set({ customerId: record.id })
    .where(and(eq(notification.email, email), isNull(notification.customerId)));

  await recomputeCustomer(record.id);
  await runPointsMaintenance(record.id);
  const loyalty = await recomputeLoyalty(record.id);

  return NextResponse.json({
    ok: true,
    customer: { id: record.id, name: record.name, email: record.email },
    claimedOrders: claimed.claimed,
    claimedPoints: claimed.points,
    points: loyalty.balance,
    tier: loyalty.tier?.name ?? null,
  });
}
