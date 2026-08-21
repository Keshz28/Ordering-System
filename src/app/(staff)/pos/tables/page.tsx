import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { order, restaurantTable } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { staffScope } from "@/lib/branches";
import { TableFloor } from "@/components/staff/table-floor";

export const metadata: Metadata = { title: "Tables" };
export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const session = await requireStaff("pos");
  const scope = await staffScope(session);

  const tables = await db
    .select()
    .from(restaurantTable)
    .where(scope.branchId ? eq(restaurantTable.branchId, scope.branchId) : undefined)
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
