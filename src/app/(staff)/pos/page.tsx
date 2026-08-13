import type { Metadata } from "next";
import { db } from "@/db";
import { restaurantTable } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { getMenu } from "@/lib/menu";
import { PosTerminal } from "@/components/staff/pos-terminal";

export const metadata: Metadata = { title: "Point of sale" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  await requireStaff("pos");

  const [categories, tables] = await Promise.all([
    getMenu({ storefront: false }),
    db.select().from(restaurantTable).orderBy(restaurantTable.number),
  ]);

  return <PosTerminal categories={categories} tables={tables} />;
}
