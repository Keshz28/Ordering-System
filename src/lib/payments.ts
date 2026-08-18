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

export const PAYMENT_METHOD_LABELS: Record<Order["paymentMethod"], string> = {
  card: "Card",
  fpx: "FPX online banking",
  duitnow_qr: "DuitNow QR",
  tng: "Touch 'n Go eWallet",
  grabpay: "GrabPay",
  boost: "Boost",
  shopeepay: "ShopeePay",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  cash: "Cash",
  simulated: "Simulated card",
};

/**
 * The payment rails Malaysian diners actually reach for. Card-only checkout
 * loses sales here — FPX and DuitNow QR carry the majority of online payments,
 * so they lead the list.
 */
export type PaymentOption = {
  id: Order["paymentMethod"];
  label: string;
  blurb: string;
  /** Rendered as a coloured monogram; avoids shipping brand assets. */
  mark: string;
  tint: string;
  /** Staff-side only (POS). */
  staffOnly?: boolean;
};

export const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: "fpx",
    label: "FPX online banking",
    blurb: "Maybank2u, CIMB Clicks, Public Bank and 15 more",
    mark: "FPX",
    tint: "bg-sky-100 text-sky-800 border-sky-200",
  },
  {
    id: "duitnow_qr",
    label: "DuitNow QR",
    blurb: "Scan with any Malaysian banking or e-wallet app",
    mark: "QR",
    tint: "bg-rose-100 text-rose-800 border-rose-200",
  },
  {
    id: "tng",
    label: "Touch 'n Go eWallet",
    blurb: "Pay from your TNG balance",
    mark: "TnG",
    tint: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    id: "grabpay",
    label: "GrabPay",
    blurb: "Earn GrabRewards points",
    mark: "Grab",
    tint: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    id: "boost",
    label: "Boost",
    blurb: "Boost wallet and BoostPay",
    mark: "Bst",
    tint: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    id: "shopeepay",
    label: "ShopeePay",
    blurb: "Pay from your Shopee wallet",
    mark: "SPay",
    tint: "bg-amber-100 text-amber-900 border-amber-200",
  },
  {
    id: "card",
    label: "Credit or debit card",
    blurb: "Visa, Mastercard and American Express",
    mark: "Card",
    tint: "bg-stone-100 text-stone-800 border-stone-200",
  },
  {
    id: "cash",
    label: "Cash",
    blurb: "Collected at the counter",
    mark: "Cash",
    tint: "bg-lime-100 text-lime-800 border-lime-200",
    staffOnly: true,
  },
];

/** The FPX bank list shown when a customer picks online banking. */
export const FPX_BANKS = [
  "Maybank2u",
  "CIMB Clicks",
  "Public Bank",
  "RHB Now",
  "Hong Leong Connect",
  "AmOnline",
  "Bank Islam",
  "Affin Bank",
  "Alliance Bank",
  "Bank Rakyat",
  "BSN",
  "OCBC Bank",
  "Standard Chartered",
  "UOB Bank",
  "Agrobank",
  "HSBC Bank",
] as const;

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
        currency: "usd",
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
          currency: "usd",
          unit_amount: Math.round(extras * 100),
          product_data: {
            name: "Service charge, tax, delivery & tip",
            description: created.discountAmount
              ? `Includes -$${created.discountAmount.toFixed(2)} discount`
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
