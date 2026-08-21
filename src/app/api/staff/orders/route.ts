import { NextResponse } from "next/server";
import { and, desc, eq, inArray, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customer, order, orderItem, type OrderStatus } from "@/db/schema";
import { logActivity, staffGuard } from "@/lib/auth";
import { staffScope } from "@/lib/branches";
import { createOrder } from "@/lib/orders";
import { quoteOrder, resolveCart, type CartLine } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIVE: OrderStatus[] = ["new", "accepted", "preparing", "ready", "dispatched"];

/** Live ticket feed for the KDS and POS. Polled every few seconds. */
export async function GET(request: Request) {
  const staff = await staffGuard("kds");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "live";

  // Floor staff only ever see their own outlet's tickets.
  const { branchId } = await staffScope(staff);
  const branchFilter = branchId ? eq(order.branchId, branchId) : undefined;

  const rows =
    scope === "today"
      ? await db
          .select()
          .from(order)
          .where(
            and(
              gte(order.placedAt, new Date(new Date().setHours(0, 0, 0, 0))),
              branchFilter,
            ),
          )
          .orderBy(desc(order.placedAt))
          .limit(80)
      : await db
          .select()
          .from(order)
          .where(and(inArray(order.status, LIVE), branchFilter))
          .orderBy(order.placedAt);

  const items = rows.length
    ? await db
        .select()
        .from(orderItem)
        .where(
          inArray(
            orderItem.orderId,
            rows.map((r) => r.id),
          ),
        )
    : [];

  return NextResponse.json(
    rows.map((o) => ({
      ...o,
      items: items.filter((i) => i.orderId === o.id),
    })),
  );
}

/* -------------------------------------------------------------------------- */
/*  POS walk-in order                                                         */
/* -------------------------------------------------------------------------- */

const posSchema = z.object({
  lines: z.array(
    z.object({
      menuItemId: z.number(),
      quantity: z.number().min(1).max(50),
      note: z.string().nullable().optional(),
      modifiers: z.record(z.string(), z.array(z.number())).optional(),
    }),
  ),
  orderType: z.enum(["dine_in", "takeout", "delivery"]),
  tableNumber: z.number().nullable().optional(),
  voucherCode: z.string().nullable().optional(),
  tip: z.number().min(0).optional(),
  paymentMethod: z.enum(["card", "cash", "simulated", "apple_pay", "google_pay"]),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional().or(z.literal("")),
  note: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const staff = await staffGuard("pos");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = posSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid order." },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const { lines, errors } = await resolveCart(body.lines as CartLine[]);
  if (lines.length === 0) {
    return NextResponse.json(
      { error: errors[0] ?? "Add something to the ticket." },
      { status: 400 },
    );
  }

  // Match a known customer by email so counter orders still build the CRM.
  let matched = null;
  const email = body.guestEmail?.toLowerCase().trim();
  if (email) {
    const [found] = await db
      .select()
      .from(customer)
      .where(eq(customer.email, email));
    matched = found ?? null;
  }

  const quote = await quoteOrder({
    lines,
    orderType: body.orderType,
    tip: body.tip ?? 0,
    voucherCode: body.voucherCode ?? null,
    customer: matched,
  });

  const created = await createOrder({
    quote,
    orderType: body.orderType,
    customer: matched,
    guest: { name: body.guestName, email: email || "walkin@bellacucina.demo" },
    tableNumber: body.tableNumber ?? null,
    paymentMethod: body.paymentMethod,
    paymentStatus: "captured",
    status: "accepted",
    source: "pos",
    note: body.note ?? null,
  });

  await logActivity(
    "Created POS order",
    `${created.number} · ${body.orderType} · ${body.paymentMethod}`,
  );

  return NextResponse.json({ orderId: created.id, number: created.number });
}

/* -------------------------------------------------------------------------- */
/*  Ticket actions                                                            */
/* -------------------------------------------------------------------------- */

const patchSchema = z.object({
  orderId: z.number(),
  action: z.enum(["advance", "set_status", "cancel", "refund", "void_item"]),
  status: z
    .enum([
      "new",
      "accepted",
      "preparing",
      "ready",
      "dispatched",
      "completed",
      "canceled",
      "refunded",
    ])
    .optional(),
  reason: z.string().optional(),
  itemId: z.number().optional(),
});

export async function PATCH(request: Request) {
  const staff = await staffGuard("kds");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  const { orderId, action } = parsed.data;

  const { advanceOrder, cancelOrder, refundOrder, getOrderWithItems } =
    await import("@/lib/orders");

  if (action === "advance" || action === "set_status") {
    const updated = await advanceOrder(orderId, parsed.data.status);
    await logActivity(
      "Bumped ticket",
      `Order #${orderId} → ${updated?.status ?? "?"}`,
    );
    return NextResponse.json(await getOrderWithItems(orderId));
  }

  if (action === "cancel") {
    // Voiding money is a supervisor action, not a line-cook one.
    if (!["owner", "manager", "cashier"].includes(staff.role)) {
      return NextResponse.json(
        { error: "Only a manager or cashier can cancel an order." },
        { status: 403 },
      );
    }
    await cancelOrder(orderId, parsed.data.reason ?? "Canceled by staff");
    await logActivity("Canceled order", `Order #${orderId}`);
    return NextResponse.json(await getOrderWithItems(orderId));
  }

  if (action === "refund") {
    if (!["owner", "manager"].includes(staff.role)) {
      return NextResponse.json(
        { error: "Only an owner or manager can issue refunds." },
        { status: 403 },
      );
    }
    const { simulateRefund } = await import("@/lib/payments");
    await simulateRefund(orderId);
    await refundOrder(orderId);
    await logActivity("Refunded order", `Order #${orderId}`);
    return NextResponse.json(await getOrderWithItems(orderId));
  }

  if (action === "void_item" && parsed.data.itemId) {
    if (!["owner", "manager", "cashier"].includes(staff.role)) {
      return NextResponse.json({ error: "Not permitted." }, { status: 403 });
    }
    const [item] = await db
      .select()
      .from(orderItem)
      .where(
        and(eq(orderItem.id, parsed.data.itemId), eq(orderItem.orderId, orderId)),
      );
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db
      .update(orderItem)
      .set({ voided: true })
      .where(eq(orderItem.id, item.id));

    // Reprice the order around the voided line.
    const [current] = await db.select().from(order).where(eq(order.id, orderId));
    if (current) {
      const remaining = await db
        .select()
        .from(orderItem)
        .where(eq(orderItem.orderId, orderId));
      const subtotal = remaining
        .filter((r) => !r.voided)
        .reduce((s, r) => s + r.lineTotal, 0);
      const discounted = Math.max(0, subtotal - current.discountAmount);
      const serviceCharge = Math.round(discounted * 0.05 * 100) / 100;
      const taxAmount =
        Math.round(
          (discounted + serviceCharge + current.deliveryFee) * 0.08 * 100,
        ) / 100;
      await db
        .update(order)
        .set({
          subtotal: Math.round(subtotal * 100) / 100,
          serviceCharge,
          taxAmount,
          total:
            Math.round(
              (discounted +
                serviceCharge +
                taxAmount +
                current.deliveryFee +
                current.tip) *
                100,
            ) / 100,
        })
        .where(eq(order.id, orderId));
    }

    await logActivity("Voided item", `${item.name} on order #${orderId}`);
    return NextResponse.json(await getOrderWithItems(orderId));
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
