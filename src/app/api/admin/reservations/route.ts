import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { reservation, restaurantTable } from "@/db/schema";
import { logActivity, staffGuard } from "@/lib/auth";
import { staffScope } from "@/lib/branches";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["confirmed", "seated", "completed", "cancelled", "no_show"]),
});

/**
 * Front-of-house booking updates.
 *
 * Seating a party marks its table occupied and completing it frees the table,
 * so the floor plan and the diary can't drift apart.
 */
export async function PATCH(request: Request) {
  const staff = await staffGuard("pos");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { id, status } = parsed.data;

  const [existing] = await db
    .select()
    .from(reservation)
    .where(eq(reservation.id, id));
  if (!existing) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  // Staff tied to a branch cannot touch another outlet's bookings.
  const scope = await staffScope(staff);
  if (scope.branchId && existing.branchId !== scope.branchId) {
    return NextResponse.json(
      { error: "That booking belongs to another branch." },
      { status: 403 },
    );
  }

  await db
    .update(reservation)
    .set({
      status,
      ...(status === "cancelled"
        ? { cancelledAt: new Date(), cancelReason: "Cancelled by staff" }
        : {}),
    })
    .where(eq(reservation.id, id));

  if (status === "seated") {
    await db
      .update(restaurantTable)
      .set({ status: "occupied" })
      .where(eq(restaurantTable.id, existing.tableId));
  }
  if (status === "completed" || status === "cancelled" || status === "no_show") {
    await db
      .update(restaurantTable)
      .set({ status: status === "completed" ? "cleaning" : "free" })
      .where(
        and(
          eq(restaurantTable.id, existing.tableId),
          eq(restaurantTable.status, "occupied"),
        ),
      );
  }

  if (status === "cancelled") {
    await notify({
      customerId: existing.customerId,
      kind: "system",
      title: "Your booking was cancelled",
      message: `${existing.reference} on ${existing.date} has been cancelled by the restaurant. Please call us if this is unexpected.`,
      href: "/account/reservations",
    });
  }

  await logActivity(
    "Reservation updated",
    `${existing.reference} → ${status}`,
    staff,
  );

  return NextResponse.json({ ok: true, status });
}
