import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { order, orderItem, type OrderStatus } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { staffScope } from "@/lib/branches";
import { KdsBoard } from "@/components/staff/kds-board";

export const metadata: Metadata = { title: "Kitchen display" };
export const dynamic = "force-dynamic";

const LIVE: OrderStatus[] = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "dispatched",
];

export default async function KdsPage() {
  const session = await requireStaff("kds");
  const scope = await staffScope(session);

  const orders = await db
    .select()
    .from(order)
    .where(
      and(
        inArray(order.status, LIVE),
        scope.branchId ? eq(order.branchId, scope.branchId) : undefined,
      ),
    )
    .orderBy(order.placedAt);

  const items = orders.length
    ? await db
        .select()
        .from(orderItem)
        .where(
          inArray(
            orderItem.orderId,
            orders.map((o) => o.id),
          ),
        )
    : [];

  return (
    <KdsBoard
      initialTickets={orders.map((o) => ({
        ...o,
        items: items.filter((i) => i.orderId === o.id),
      }))}
      canCancel={["owner", "manager", "cashier"].includes(session.role)}
    />
  );
}
