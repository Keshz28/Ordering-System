import { NextResponse } from "next/server";
import { z } from "zod";
import { currentCustomer } from "@/lib/auth";
import { quoteOrder, resolveCart, type CartLine } from "@/lib/pricing";

export const runtime = "nodejs";

const bodySchema = z.object({
  lines: z.array(
    z.object({
      menuItemId: z.number(),
      quantity: z.number().min(1).max(50),
      note: z.string().nullable().optional(),
      modifiers: z.record(z.string(), z.array(z.number())).optional(),
    }),
  ),
  orderType: z.enum(["dine_in", "takeout", "delivery"]),
  zoneId: z.number().nullable().optional(),
  tip: z.number().min(0).max(500).optional(),
  voucherCode: z.string().nullable().optional(),
});

/**
 * Single source of truth for checkout maths. The client never computes totals;
 * it re-quotes on every change so voucher rules, tier discounts and promotions
 * are always evaluated server-side against live data.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkout payload." },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const customer = await currentCustomer();
  const { lines, errors } = await resolveCart(body.lines as CartLine[]);

  if (lines.length === 0) {
    return NextResponse.json(
      { error: errors[0] ?? "Your cart is empty.", errors },
      { status: 400 },
    );
  }

  const quote = await quoteOrder({
    lines,
    orderType: body.orderType,
    zoneId: body.zoneId ?? null,
    tip: body.tip ?? 0,
    voucherCode: body.voucherCode ?? null,
    customer,
  });

  return NextResponse.json({
    ...quote,
    itemErrors: errors,
    signedIn: Boolean(customer),
    customerName: customer?.name ?? null,
    customerEmail: customer?.email ?? null,
  });
}
