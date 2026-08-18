import { eq } from "drizzle-orm";
import { db } from "@/db";
import { order, type Order } from "@/db/schema";
import type { ResolvedLine } from "./pricing";

/**
 * Stripe is entirely optional. With STRIPE_SECRET_KEY set, card orders go
 * through a real test-mode Checkout Session. Without it the app runs a
 * simulated capture that drives the identical payment state machine, so the
 * demo behaves the same either way.
 */
export function stripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Presentation constants live in a db-free module so client components can
// import them without pulling in the Stripe SDK.
export {
  PAYMENT_METHOD_LABELS,
  PAYMENT_OPTIONS,
  FPX_BANKS,
  type PaymentOption,
} from "./payment-options";

export const PAYMENT_STATUS_LABELS: Record<Order["paymentStatus"], string> = {
  pending: "Pending",
  authorized: "Authorized",
  captured: "Captured",
  failed: "Failed",
  refunded: "Refunded",
};

function baseUrl(request: Request) {
  const env = process.env.STRIPE_WEBHOOK_BASE_URL ?? process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function createStripeCheckout({
  order: created,
  lines,
  request,
}: {
  order: Order;
  lines: ResolvedLine[];
  request: Request;
}) {
  if (!stripeEnabled()) return null;
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const origin = baseUrl(request);

    const lineItems = lines.map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency: "myr",
        unit_amount: Math.round(l.unitPrice * 100),
        product_data: {
          name: l.name,
          description:
            l.resolvedModifiers.map((m) => m.optionName).join(", ") || undefined,
        },
      },
    }));

    // Fees, tax and tip ride along as their own line so the Stripe total
    // matches the order total exactly.
    const extras =
      created.serviceCharge +
      created.taxAmount +
      created.deliveryFee +
      created.tip -
      created.discountAmount;
    if (extras > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "myr",
          unit_amount: Math.round(extras * 100),
          product_data: {
            name: "Service charge, tax, delivery & tip",
            description: created.discountAmount
              ? `Includes -RM${created.discountAmount.toFixed(2)} discount`
              : undefined,
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: created.guestEmail ?? undefined,
      client_reference_id: String(created.id),
      metadata: { orderNumber: created.number },
      success_url: `${origin}/order/${created.id}?paid=1`,
      cancel_url: `${origin}/checkout?canceled=1`,
    });

    await db
      .update(order)
      .set({
        checkoutSessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        paymentStatus: "pending",
      })
      .where(eq(order.id, created.id));

    return session;
  } catch (error) {
    console.error("[stripe] checkout session failed", error);
    return null;
  }
}

/**
 * Webhook-free status check used by the receipt page: asks Stripe directly
 * whether the session was paid, then syncs our record.
 */
export async function syncStripePayment(orderId: number) {
  const [row] = await db.select().from(order).where(eq(order.id, orderId));
  if (!row?.checkoutSessionId || !stripeEnabled()) return row ?? null;

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(row.checkoutSessionId);

    if (session.payment_status === "paid" && row.paymentStatus !== "captured") {
      await db
        .update(order)
        .set({
          paymentStatus: "captured",
          status: row.status === "new" ? "accepted" : row.status,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : row.paymentIntentId,
        })
        .where(eq(order.id, orderId));
      return { ...row, paymentStatus: "captured" as const };
    }
  } catch (error) {
    console.error("[stripe] sync failed", error);
  }
  return row;
}

export async function simulateRefund(orderId: number) {
  const [row] = await db.select().from(order).where(eq(order.id, orderId));
  if (!row) return null;

  if (stripeEnabled() && row.paymentIntentId?.startsWith("pi_") && !row.paymentIntentId.startsWith("pi_demo")) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      await stripe.refunds.create({ payment_intent: row.paymentIntentId });
    } catch (error) {
      console.error("[stripe] refund failed", error);
    }
  }
  return row;
}
