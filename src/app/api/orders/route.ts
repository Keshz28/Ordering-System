import { NextResponse } from "next/server";
import { z } from "zod";
import { currentCustomer } from "@/lib/auth";
import { createOrder } from "@/lib/orders";
import { quoteOrder, resolveCart, type CartLine } from "@/lib/pricing";
import { createStripeCheckout, stripeEnabled } from "@/lib/payments";

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
  tableNumber: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
  pickupSlot: z.string().nullable().optional(),
  paymentMethod: z.enum(["card", "apple_pay", "google_pay", "cash", "simulated"]),
  guestName: z.string().min(1, "Tell us your name."),
  guestEmail: z.string().email("Enter a valid email address."),
  guestPhone: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid order." },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const customer = await currentCustomer();

  const { lines, errors } = await resolveCart(body.lines as CartLine[]);
  if (lines.length === 0) {
    return NextResponse.json(
      { error: errors[0] ?? "Your cart is empty." },
      { status: 400 },
    );
  }

  // Re-quote server-side: the client's numbers are never trusted.
  const quote = await quoteOrder({
    lines,
    orderType: body.orderType,
    zoneId: body.zoneId ?? null,
    tip: body.tip ?? 0,
    voucherCode: body.voucherCode ?? null,
    customer,
  });

  if (body.orderType === "delivery" && !body.zoneId) {
    return NextResponse.json(
      { error: "Choose a delivery zone." },
      { status: 400 },
    );
  }
  if (body.orderType === "delivery" && quote.zone && quote.subtotal < quote.zone.minOrder) {
    return NextResponse.json(
      {
        error: `${quote.zone.name} has a $${quote.zone.minOrder.toFixed(2)} minimum order.`,
      },
      { status: 400 },
    );
  }
  if (body.orderType === "dine_in" && !body.tableNumber) {
    return NextResponse.json({ error: "Pick a table." }, { status: 400 });
  }

  const useStripe = stripeEnabled() && body.paymentMethod === "card";

  const created = await createOrder({
    quote,
    orderType: body.orderType,
    customer,
    guest: {
      name: body.guestName,
      email: body.guestEmail,
      phone: body.guestPhone ?? null,
    },
    tableNumber: body.tableNumber ?? null,
    address: body.address ?? null,
    pickupSlot: body.pickupSlot ?? null,
    paymentMethod: body.paymentMethod,
    // Cash is settled at the counter; everything else is captured immediately
    // (or by Stripe, once the hosted checkout returns).
    paymentStatus:
      body.paymentMethod === "cash"
        ? "pending"
        : useStripe
          ? "pending"
          : "captured",
    status: useStripe ? "new" : "accepted",
    note: body.note ?? null,
  });

  if (useStripe) {
    const session = await createStripeCheckout({
      order: created,
      lines: quote.lines,
      request,
    });
    if (session?.url) {
      return NextResponse.json({
        orderId: created.id,
        number: created.number,
        checkoutUrl: session.url,
      });
    }
    // Stripe misconfigured at runtime — fall back rather than dead-end the demo.
  }

  return NextResponse.json({
    orderId: created.id,
    number: created.number,
    checkoutUrl: null,
  });
}
