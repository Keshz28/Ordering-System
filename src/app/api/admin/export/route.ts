import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { customer, order, orderItem } from "@/db/schema";
import { staffGuard } from "@/lib/auth";
import { REVENUE_STATUSES, revenueByDay, salesByHour } from "@/lib/analytics";
import { toCsv } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV export for orders, customers, daily sales and item performance. */
export async function GET(request: Request) {
  const staff = await staffGuard("admin");
  if (!staff) return new Response("Forbidden", { status: 403 });

  const type = new URL(request.url).searchParams.get("type") ?? "orders";
  let csv = "";
  let filename = "export.csv";

  if (type === "orders") {
    const rows = await db.select().from(order).orderBy(desc(order.placedAt));
    csv = toCsv(
      rows.map((o) => ({
        number: o.number,
        placed_at: o.placedAt.toISOString(),
        status: o.status,
        type: o.type,
        source: o.source,
        customer: o.guestName ?? "",
        email: o.guestEmail ?? "",
        table: o.tableNumber ?? "",
        subtotal: o.subtotal.toFixed(2),
        discount: o.discountAmount.toFixed(2),
        voucher: o.voucherCode ?? "",
        service_charge: o.serviceCharge.toFixed(2),
        delivery_fee: o.deliveryFee.toFixed(2),
        tax: o.taxAmount.toFixed(2),
        tip: o.tip.toFixed(2),
        total: o.total.toFixed(2),
        payment_method: o.paymentMethod,
        payment_status: o.paymentStatus,
        points_earned: o.pointsEarned,
      })),
    );
    filename = "bella-cucina-orders.csv";
  } else if (type === "customers") {
    const rows = await db
      .select()
      .from(customer)
      .orderBy(desc(customer.totalSpent));
    csv = toCsv(
      rows.map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone ?? "",
        birthday: c.birthday ?? "",
        segment: c.segment,
        orders: c.orderCount,
        total_spent: c.totalSpent.toFixed(2),
        average_order: c.orderCount
          ? (c.totalSpent / c.orderCount).toFixed(2)
          : "0.00",
        loyalty_points: c.loyaltyPoints,
        tier_points: c.tierPoints,
        last_order: c.lastOrderAt?.toISOString() ?? "",
        allergies: (c.allergies ?? []).join("; "),
        high_aov: c.highAov ? "yes" : "no",
        promo_hunter: c.promoHunter ? "yes" : "no",
        marketing_opt_in: c.marketingOptIn ? "yes" : "no",
      })),
    );
    filename = "bella-cucina-customers.csv";
  } else if (type === "sales_by_day") {
    const rows = await revenueByDay(90);
    csv = toCsv(
      rows.map((r) => ({
        date: r.day,
        orders: r.orders,
        revenue: r.revenue.toFixed(2),
      })),
    );
    filename = "bella-cucina-sales-by-day.csv";
  } else if (type === "sales_by_hour") {
    const rows = await salesByHour();
    csv = toCsv(
      rows.map((r) => ({
        hour: r.label,
        orders: r.orders,
        revenue: r.revenue.toFixed(2),
      })),
    );
    filename = "bella-cucina-sales-by-hour.csv";
  } else if (type === "products") {
    const revenueOrders = await db
      .select({ id: order.id })
      .from(order)
      .where(inArray(order.status, REVENUE_STATUSES));
    const ids = revenueOrders.map((o) => o.id);
    const lines = ids.length
      ? await db.select().from(orderItem).where(inArray(orderItem.orderId, ids))
      : [];

    const byName = new Map<string, { units: number; revenue: number }>();
    for (const l of lines) {
      const cur = byName.get(l.name) ?? { units: 0, revenue: 0 };
      cur.units += l.quantity;
      cur.revenue += l.lineTotal;
      byName.set(l.name, cur);
    }

    csv = toCsv(
      Array.from(byName.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([name, v]) => ({
          item: name,
          units_sold: v.units,
          revenue: v.revenue.toFixed(2),
          average_price: (v.revenue / Math.max(1, v.units)).toFixed(2),
        })),
    );
    filename = "bella-cucina-product-performance.csv";
  } else {
    return new Response("Unknown export type", { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
