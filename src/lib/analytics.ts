import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  campaign,
  customer,
  menuItem,
  order,
  orderItem,
  voucher,
  voucherRedemption,
  type OrderStatus,
} from "@/db/schema";
import { round2 } from "./utils";

/** Statuses that count as real revenue — canceled and refunded never do. */
export const REVENUE_STATUSES: OrderStatus[] = [
  "accepted",
  "preparing",
  "ready",
  "dispatched",
  "completed",
];

const KITCHEN_STATUSES: OrderStatus[] = ["new", "accepted", "preparing"];

function startOfDay(d = new Date()) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

/* -------------------------------------------------------------------------- */
/*  KPI cards                                                                 */
/* -------------------------------------------------------------------------- */

export async function getKpis() {
  const today = startOfDay();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [todayRow] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${order.total}), 0)`,
      orders: sql<number>`count(*)`,
    })
    .from(order)
    .where(
      and(gte(order.placedAt, today), inArray(order.status, REVENUE_STATUSES)),
    );

  const [allTimeRow] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${order.total}), 0)`,
      orders: sql<number>`count(*)`,
    })
    .from(order)
    .where(inArray(order.status, REVENUE_STATUSES));

  const [pendingRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(order)
    .where(inArray(order.status, KITCHEN_STATUSES));

  const [newCustomerRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(customer)
    .where(gte(customer.createdAt, monthStart));

  const [thirtyRow] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${order.total}), 0)`,
      orders: sql<number>`count(*)`,
    })
    .from(order)
    .where(
      and(
        gte(order.placedAt, daysAgo(30)),
        inArray(order.status, REVENUE_STATUSES),
      ),
    );

  const orders30 = Number(thirtyRow?.orders ?? 0);

  return {
    todayRevenue: round2(Number(todayRow?.revenue ?? 0)),
    todayOrders: Number(todayRow?.orders ?? 0),
    revenue30: round2(Number(thirtyRow?.revenue ?? 0)),
    orders30,
    averageOrderValue: orders30
      ? round2(Number(thirtyRow.revenue) / orders30)
      : 0,
    pendingKitchen: Number(pendingRow?.n ?? 0),
    newCustomersThisMonth: Number(newCustomerRow?.n ?? 0),
    lifetimeRevenue: round2(Number(allTimeRow?.revenue ?? 0)),
    lifetimeOrders: Number(allTimeRow?.orders ?? 0),
  };
}

/* -------------------------------------------------------------------------- */
/*  Charts                                                                    */
/* -------------------------------------------------------------------------- */

export async function revenueByDay(days = 30) {
  const rows = await db
    .select({
      day: sql<string>`date(${order.placedAt}, 'unixepoch', 'localtime')`,
      revenue: sql<number>`sum(${order.total})`,
      orders: sql<number>`count(*)`,
    })
    .from(order)
    .where(
      and(
        gte(order.placedAt, daysAgo(days)),
        inArray(order.status, REVENUE_STATUSES),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  // Fill the gaps so the line chart never breaks on a quiet day.
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; label: string; revenue: number; orders: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    const found = byDay.get(key);
    out.push({
      day: key,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: round2(Number(found?.revenue ?? 0)),
      orders: Number(found?.orders ?? 0),
    });
  }
  return out;
}

export async function salesByHour() {
  const rows = await db
    .select({
      hour: sql<string>`strftime('%H', ${order.placedAt}, 'unixepoch', 'localtime')`,
      revenue: sql<number>`sum(${order.total})`,
      orders: sql<number>`count(*)`,
    })
    .from(order)
    .where(inArray(order.status, REVENUE_STATUSES))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const byHour = new Map(rows.map((r) => [Number(r.hour), r]));
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, "0")}:00`,
    revenue: round2(Number(byHour.get(h)?.revenue ?? 0)),
    orders: Number(byHour.get(h)?.orders ?? 0),
  })).filter((r) => r.hour >= 10 && r.hour <= 23);
}

export async function ordersByType() {
  const rows = await db
    .select({
      type: order.type,
      orders: sql<number>`count(*)`,
      revenue: sql<number>`sum(${order.total})`,
    })
    .from(order)
    .where(inArray(order.status, REVENUE_STATUSES))
    .groupBy(order.type);

  const labels = { dine_in: "Dine-in", takeout: "Takeaway", delivery: "Delivery" };
  return rows.map((r) => ({
    key: r.type,
    name: labels[r.type],
    orders: Number(r.orders),
    revenue: round2(Number(r.revenue)),
  }));
}

export async function paymentMix() {
  const rows = await db
    .select({
      method: order.paymentMethod,
      orders: sql<number>`count(*)`,
      revenue: sql<number>`sum(${order.total})`,
    })
    .from(order)
    .where(inArray(order.status, REVENUE_STATUSES))
    .groupBy(order.paymentMethod);

  const labels = {
    card: "Card",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    cash: "Cash",
    simulated: "Simulated",
  };
  return rows.map((r) => ({
    key: r.method,
    name: labels[r.method],
    orders: Number(r.orders),
    revenue: round2(Number(r.revenue)),
  }));
}

export async function topItems(limit = 10) {
  const rows = await db
    .select({
      menuItemId: orderItem.menuItemId,
      name: orderItem.name,
      units: sql<number>`sum(${orderItem.quantity})`,
      revenue: sql<number>`sum(${orderItem.lineTotal})`,
    })
    .from(orderItem)
    .innerJoin(order, eq(orderItem.orderId, order.id))
    .where(inArray(order.status, REVENUE_STATUSES))
    .groupBy(orderItem.name)
    .orderBy(desc(sql`sum(${orderItem.quantity})`))
    .limit(limit);

  return rows.map((r) => ({
    name: r.name,
    units: Number(r.units),
    revenue: round2(Number(r.revenue)),
  }));
}

export async function topItemsByRevenue(limit = 10) {
  const rows = await db
    .select({
      name: orderItem.name,
      units: sql<number>`sum(${orderItem.quantity})`,
      revenue: sql<number>`sum(${orderItem.lineTotal})`,
    })
    .from(orderItem)
    .innerJoin(order, eq(orderItem.orderId, order.id))
    .where(inArray(order.status, REVENUE_STATUSES))
    .groupBy(orderItem.name)
    .orderBy(desc(sql`sum(${orderItem.lineTotal})`))
    .limit(limit);

  return rows.map((r) => ({
    name: r.name,
    units: Number(r.units),
    revenue: round2(Number(r.revenue)),
  }));
}

/** Promotion ROI: discount given away vs revenue on the orders that used it. */
export async function promotionPerformance() {
  const rows = await db
    .select({
      voucherId: voucherRedemption.voucherId,
      code: voucher.code,
      title: voucher.title,
      redemptions: sql<number>`count(*)`,
      discount: sql<number>`sum(${voucherRedemption.discountAmount})`,
      revenue: sql<number>`sum(${voucherRedemption.orderRevenue})`,
    })
    .from(voucherRedemption)
    .innerJoin(voucher, eq(voucherRedemption.voucherId, voucher.id))
    .groupBy(voucherRedemption.voucherId)
    .orderBy(desc(sql`count(*)`));

  return rows.map((r) => {
    const discount = round2(Number(r.discount));
    const revenue = round2(Number(r.revenue));
    return {
      code: r.code,
      title: r.title,
      redemptions: Number(r.redemptions),
      discount,
      revenue,
      // Net revenue returned per dollar discounted.
      roi: discount > 0 ? round2((revenue - discount) / discount) : null,
    };
  });
}

export async function newVsReturning(days = 30) {
  const rows = await db
    .select({
      day: sql<string>`date(${order.placedAt}, 'unixepoch', 'localtime')`,
      customerId: order.customerId,
      placedAt: order.placedAt,
    })
    .from(order)
    .where(
      and(
        gte(order.placedAt, daysAgo(days)),
        inArray(order.status, REVENUE_STATUSES),
      ),
    )
    .orderBy(order.placedAt);

  const seen = new Set<number>();
  const buckets = new Map<string, { new: number; returning: number }>();

  for (const row of rows) {
    const bucket = buckets.get(row.day) ?? { new: 0, returning: 0 };
    if (row.customerId && seen.has(row.customerId)) bucket.returning += 1;
    else {
      bucket.new += 1;
      if (row.customerId) seen.add(row.customerId);
    }
    buckets.set(row.day, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      day,
      label: new Date(day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      ...v,
    }));
}

export async function segmentBreakdown() {
  const rows = await db
    .select({
      segment: customer.segment,
      n: sql<number>`count(*)`,
      value: sql<number>`coalesce(sum(${customer.totalSpent}), 0)`,
    })
    .from(customer)
    .groupBy(customer.segment);

  return rows.map((r) => ({
    segment: r.segment,
    customers: Number(r.n),
    value: round2(Number(r.value)),
  }));
}

/** Average lifetime value by cohort month — the "is this business growing" chart. */
export async function monthlyLtv() {
  const rows = await db
    .select({
      month: sql<string>`strftime('%Y-%m', ${order.placedAt}, 'unixepoch', 'localtime')`,
      revenue: sql<number>`sum(${order.total})`,
      customers: sql<number>`count(distinct ${order.customerId})`,
    })
    .from(order)
    .where(inArray(order.status, REVENUE_STATUSES))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return rows.map((r) => ({
    month: r.month,
    label: new Date(`${r.month}-01`).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
    revenue: round2(Number(r.revenue)),
    customers: Number(r.customers),
    ltv: Number(r.customers)
      ? round2(Number(r.revenue) / Number(r.customers))
      : 0,
  }));
}

export async function campaignPerformance() {
  const rows = await db
    .select()
    .from(campaign)
    .where(eq(campaign.status, "sent"))
    .orderBy(desc(campaign.sentAt));

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    segment: c.targetSegment,
    sentAt: c.sentAt,
    recipients: c.recipients,
    opens: c.opens,
    clicks: c.clicks,
    redeemed: c.redeemed,
    revenue: round2(c.revenue),
    discountCost: round2(c.discountCost),
    roi: c.discountCost > 0 ? round2(c.revenue / c.discountCost) : null,
  }));
}

export async function lowStockItems() {
  return db
    .select()
    .from(menuItem)
    .where(sql`${menuItem.stock} is not null and ${menuItem.stock} <= 5`)
    .orderBy(menuItem.stock);
}
