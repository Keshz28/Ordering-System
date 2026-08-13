import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { order, restaurantTable } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { TableFloor } from "@/components/staff/table-floor";

export const metadata: Metadata = { title: "Tables" };
export const dynamic = "force-dynamic";

export default async function TablesPage() {
  await requireStaff("pos");

  const tables = await db
    .select()
    .from(restaurantTable)
    .orderBy(restaurantTable.number);

  const activeIds = tables
    .map((t) => t.currentOrderId)
    .filter((id): id is number => Boolean(id));

  const orders = activeIds.length
    ? await db.select().from(order).where(inArray(order.id, activeIds))
    : [];

  return (
    <TableFloor
      tables={tables}
      orders={orders.map((o) => ({
        id: o.id,
        number: o.number,
        total: o.total,
        status: o.status,
      }))}
    />
  );
}
