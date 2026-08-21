import type { Metadata } from "next";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { restaurantTable } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { staffScope } from "@/lib/branches";
import { getMenu } from "@/lib/menu";
import { PosTerminal } from "@/components/staff/pos-terminal";

export const metadata: Metadata = { title: "Point of sale" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const session = await requireStaff("pos");
  // A cashier builds walk-in orders only for their own floor.
  const scope = await staffScope(session);

  const [categories, tables] = await Promise.all([
    getMenu({ storefront: false }),
    scope.branchId
      ? db
          .select()
          .from(restaurantTable)
          .where(eq(restaurantTable.branchId, scope.branchId))
          .orderBy(restaurantTable.number)
      : db.select().from(restaurantTable).orderBy(restaurantTable.number),
  ]);

  return <PosTerminal categories={categories} tables={tables} />;
}
