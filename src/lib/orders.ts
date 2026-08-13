import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customer as customerTable,
  customerVoucher,
  menuItem,
  order,
  orderItem,
  restaurantTable,
  voucher as voucherTable,
  voucherRedemption,
  type Customer,
  type Order,
  type OrderStatus,
  type OrderType,
} from "@/db/schema";
import { notify } from "./notify";
import { awardPoints, activatePointsForOrder, clawbackPointsForOrder } from "./loyalty";
import { recomputeCustomer } from "./segments";
import { getSettings, type Quote } from "./pricing";
import { round2 } from "./utils";

/** BC-#### references. Sequential so staff can read them aloud. */
export async function nextOrderNumber() {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(order);
  return `BC-${2400 + Number(row?.n ?? 0) + 7}`;
}

// Status helpers live in a db-free module so client components can import them.
export {
  STATUS_FLOW,
  STATUS_LABELS,
  stepsFor,
  nextStatus,
} from "./order-status";
import { nextStatus, STATUS_LABELS } from "./order-status";

/* -------------------------------------------------------------------------- */
/*  Creation                                                                  */
/* -------------------------------------------------------------------------- */

export type CreateOrderInput = {
  quote: Quote;
  orderType: OrderType;
  customer: Customer | null;
  guest: { name: string; email: string; phone?: string | null };
  tableNumber?: number | null;
  address?: string | null;
  pickupSlot?: string | null;
  paymentMethod: Order["paymentMethod"];
  paymentStatus?: Order["paymentStatus"];
  source?: "storefront" | "pos";
  note?: string | null;
  status?: OrderStatus;
};

export async function createOrder(input: CreateOrderInput) {
  const { quote } = input;
  const settings = await getSettings();
  const number = await nextOrderNumber();

  const prepMinutes = Math.max(
    12,
    ...quote.lines.map(() => 12),
  );
  const etaMinutes =
    input.orderType === "delivery"
      ? prepMinutes + (quote.zone?.etaMinutes ?? 30)
      : prepMinutes + 4;

  const [created] = await db
    .insert(order)
    .values({
      number,
      customerId: input.customer?.id ?? null,
      guestName: input.guest.name,
      guestEmail: input.guest.email.toLowerCase().trim(),
      guestPhone: input.guest.phone ?? null,
      type: input.orderType,
      tableNumber: input.tableNumber ?? null,
      address: input.address ?? null,
      deliveryZoneId: quote.zone?.id ?? null,
      pickupSlot: input.pickupSlot ?? null,
      status: input.status ?? "new",
      subtotal: quote.subtotal,
      serviceCharge: quote.serviceCharge,
      taxAmount: quote.taxAmount,
      deliveryFee: quote.deliveryFee,
      discountAmount: quote.discountAmount,
      tip: quote.tip,
      total: quote.total,
      appliedDiscounts: quote.appliedDiscounts,
      voucherId: quote.voucher?.id ?? null,
      voucherCode: quote.voucher?.code ?? null,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus ?? "pending",
      pointsEarned: quote.pointsEarned,
      placedAt: new Date(),
      eta: new Date(Date.now() + etaMinutes * 60_000),
      note: input.note ?? null,
      source: input.source ?? "storefront",
    })
    .returning();

  for (const line of quote.lines) {
    await db.insert(orderItem).values({
      orderId: created.id,
      menuItemId: line.menuItemId,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      note: line.note,
      resolvedModifiers: line.resolvedModifiers,
      course: line.course,
    });

    // Tracked stock decrements; untracked items (stock === null) are untouched.
    await db
      .update(menuItem)
      .set({ stock: sql`max(0, ${menuItem.stock} - ${line.quantity})` })
      .where(and(eq(menuItem.id, line.menuItemId), sql`${menuItem.stock} is not null`));
  }

  // --- voucher bookkeeping -------------------------------------------------
  if (quote.voucher) {
    await db
      .update(voucherTable)
      .set({ usesCount: sql`${voucherTable.usesCount} + 1` })
      .where(eq(voucherTable.id, quote.voucher.id));

    await db.insert(voucherRedemption).values({
      voucherId: quote.voucher.id,
      customerId: input.customer?.id ?? null,
      email: input.guest.email.toLowerCase().trim(),
      orderId: created.id,
      discountAmount:
        quote.appliedDiscounts.find((d) => d.kind === "voucher")?.amount ?? 0,
      orderRevenue: quote.total,
    });

    if (input.customer) {
      await db
        .update(customerVoucher)
        .set({ redeemedAt: new Date(), redeemedOrderId: created.id })
        .where(
          and(
            eq(customerVoucher.customerId, input.customer.id),
            eq(customerVoucher.voucherId, quote.voucher.id),
          ),
        );
    }
  }

  // --- table ---------------------------------------------------------------
  if (input.orderType === "dine_in" && input.tableNumber) {
    await db
      .update(restaurantTable)
      .set({ status: "occupied", currentOrderId: created.id })
      .where(eq(restaurantTable.number, input.tableNumber));
  }

  // --- loyalty & CRM -------------------------------------------------------
  if (input.customer && quote.pointsEarned > 0) {
    await awardPoints({
      customerId: input.customer.id,
      orderId: created.id,
      points: quote.pointsEarned,
      expiryMonths: settings.pointsExpiryMonths,
    });
  }

  await notify({
    customerId: input.customer?.id ?? null,
    email: input.guest.email.toLowerCase().trim(),
    orderId: created.id,
    kind: "order",
    channel: "push",
    title: `Order ${number} received`,
    message:
      input.orderType === "delivery"
        ? `We're on it. Estimated delivery in about ${etaMinutes} minutes.`
        : `We're on it. Ready in about ${etaMinutes} minutes.`,
    href: `/order/${created.id}`,
  });

  if (input.customer) await recomputeCustomer(input.customer.id);

  return created;
}

/* -------------------------------------------------------------------------- */
/*  Status transitions                                                        */
/* -------------------------------------------------------------------------- */

export async function advanceOrder(orderId: number, to?: OrderStatus) {
  const [current] = await db.select().from(order).where(eq(order.id, orderId));
  if (!current) return null;

  const target = to ?? nextStatus(current.status, current.type);
  if (!target) return current;

  const patch: Partial<Order> = { status: target };
  if (target === "accepted" && !current.acceptedAt) patch.acceptedAt = new Date();
  if (target === "ready" && !current.readyAt) patch.readyAt = new Date();
  if (target === "completed") patch.completedAt = new Date();

  await db.update(order).set(patch).where(eq(order.id, orderId));

  const messages: Partial<Record<OrderStatus, string>> = {
    accepted: "Your order is confirmed and heading to the kitchen.",
    preparing: "The kitchen has started on your order.",
    ready:
      current.type === "delivery"
        ? "Your order is packed and waiting for a rider."
        : "Your order is ready for collection.",
    dispatched: "Your order is on its way.",
    completed: "Enjoy — thanks for ordering with Bella Cucina.",
  };

  if (messages[target]) {
    await notify({
      customerId: current.customerId,
      email: current.guestEmail,
      orderId: current.id,
      kind: "order",
      channel: "push",
      title: `Order ${current.number}: ${STATUS_LABELS[target]}`,
      message: messages[target]!,
      href: `/order/${current.id}`,
    });
  }

  if (target === "completed") {
    await activatePointsForOrder(orderId);
    if (current.tableNumber) {
      await db
        .update(restaurantTable)
        .set({ status: "cleaning", currentOrderId: null })
        .where(eq(restaurantTable.number, current.tableNumber));
    }
    if (current.customerId) await recomputeCustomer(current.customerId);
  }

  return { ...current, ...patch };
}

export async function cancelOrder(orderId: number, reason: string) {
  const [current] = await db.select().from(order).where(eq(order.id, orderId));
  if (!current) return null;

  await db
    .update(order)
    .set({ status: "canceled", cancelReason: reason, paymentStatus: "refunded" })
    .where(eq(order.id, orderId));

  await clawbackPointsForOrder(orderId);

  if (current.tableNumber) {
    await db
      .update(restaurantTable)
      .set({ status: "free", currentOrderId: null })
      .where(eq(restaurantTable.number, current.tableNumber));
  }

  await notify({
    customerId: current.customerId,
    email: current.guestEmail,
    orderId,
    kind: "order",
    title: `Order ${current.number} canceled`,
    message: `${reason}. Any payment has been refunded in full.`,
    href: `/order/${orderId}`,
  });

  if (current.customerId) await recomputeCustomer(current.customerId);
  return current;
}

export async function refundOrder(orderId: number) {
  const [current] = await db.select().from(order).where(eq(order.id, orderId));
  if (!current) return null;

  await db
    .update(order)
    .set({ status: "refunded", paymentStatus: "refunded" })
    .where(eq(order.id, orderId));

  // Anti-gaming rule: points earned on a refunded order are clawed back.
  await clawbackPointsForOrder(orderId);

  await notify({
    customerId: current.customerId,
    email: current.guestEmail,
    orderId,
    kind: "order",
    title: `Order ${current.number} refunded`,
    message: `${round2(current.total).toFixed(2)} has been returned to your original payment method.`,
    href: `/order/${orderId}`,
  });

  if (current.customerId) await recomputeCustomer(current.customerId);
  return current;
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

export async function getOrderWithItems(orderId: number) {
  const [row] = await db.select().from(order).where(eq(order.id, orderId));
  if (!row) return null;
  const items = await db
    .select()
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId));
  return { ...row, items };
}

/** Attaches guest-checkout orders to a customer once they verify that email. */
export async function claimGuestOrders(customer: Customer) {
  const email = customer.email.toLowerCase().trim();
  const orphans = await db
    .select()
    .from(order)
    .where(and(eq(order.guestEmail, email), sql`${order.customerId} is null`));

  if (orphans.length === 0) return { claimed: 0, points: 0 };

  const settings = await getSettings();
  let points = 0;

  for (const o of orphans) {
    await db
      .update(order)
      .set({ customerId: customer.id })
      .where(eq(order.id, o.id));

    // Retroactively credit the loyalty they would have earned when signed in.
    const food = round2(o.subtotal - o.discountAmount);
    const earned = Math.max(0, Math.floor(food * 10));
    if (earned > 0) {
      await awardPoints({
        customerId: customer.id,
        orderId: o.id,
        points: earned,
        expiryMonths: settings.pointsExpiryMonths,
        reason: "claimed order",
      });
      if (o.status === "completed") await activatePointsForOrder(o.id);
      await db
        .update(order)
        .set({ pointsEarned: earned })
        .where(eq(order.id, o.id));
      points += earned;
    }
  }

  await db
    .update(customerTable)
    .set({ orderCount: sql`${customerTable.orderCount} + ${orphans.length}` })
    .where(eq(customerTable.id, customer.id));

  await recomputeCustomer(customer.id);

  await notify({
    customerId: customer.id,
    kind: "loyalty",
    title: `${orphans.length} past order${orphans.length === 1 ? "" : "s"} added to your account`,
    message: `We matched ${orphans.length} guest order${
      orphans.length === 1 ? "" : "s"
    } to your email and credited ${points.toLocaleString()} points.`,
    href: "/account/orders",
  });

  return { claimed: orphans.length, points };
}
