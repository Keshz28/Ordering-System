import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { restaurantTable } from "@/db/schema";
import { logActivity, staffGuard } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  id: z.number(),
  status: z.enum(["free", "occupied", "reserved", "cleaning"]),
});

export async function PATCH(request: Request) {
  const staff = await staffGuard("pos");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid table update." }, { status: 400 });
  }

  const [table] = await db
    .select()
    .from(restaurantTable)
    .where(eq(restaurantTable.id, parsed.data.id));
  if (!table) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(restaurantTable)
    .set({
      status: parsed.data.status,
      // Freeing or cleaning a table releases whatever order was sitting on it.
      currentOrderId:
        parsed.data.status === "free" || parsed.data.status === "cleaning"
          ? null
          : table.currentOrderId,
    })
    .where(eq(restaurantTable.id, parsed.data.id));

  await logActivity(
    "Changed table status",
    `Table ${table.number} → ${parsed.data.status}`,
  );

  return NextResponse.json({ ok: true });
}
