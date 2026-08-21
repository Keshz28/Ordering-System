import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customer, reservation, restaurantTable } from "@/db/schema";
import { logActivity, staffGuard } from "@/lib/auth";
import { staffScope } from "@/lib/branches";
import { notify } from "@/lib/notify";
import { createReservation } from "@/lib/reservations";

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

/* -------------------------------------------------------------------------- */
/*  Staff-created bookings                                                    */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  branchId: z.number().int().positive(),
  tableId: z.number().int().positive(),
  partySize: z.number().int().min(1).max(30),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().min(1, "Enter the guest's name."),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().max(40).optional().nullable(),
  occasion: z
    .enum(["none", "birthday", "anniversary", "business", "date", "celebration"])
    .optional(),
  notes: z.string().max(400).optional().nullable(),
});

/**
 * A booking taken by staff — over the phone or at the door.
 *
 * Unlike the guest flow the details come from the request body, because the
 * person being booked isn't the person signed in. The guest is matched by
 * email and created if new, so a phone booking still builds the CRM record and
 * the confirmation lands in their inbox when they first sign in.
 */
export async function POST(request: Request) {
  const staff = await staffGuard("pos");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid booking details." },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const scope = await staffScope(staff);
  if (scope.branchId && input.branchId !== scope.branchId) {
    return NextResponse.json(
      { error: "You can only book for your own branch." },
      { status: 403 },
    );
  }

  const email = input.email.toLowerCase().trim();
  const existing = await db
    .select()
    .from(customer)
    .where(eq(customer.email, email));

  let guest = existing[0];
  let createdGuest = false;
  if (!guest) {
    const [row] = await db
      .insert(customer)
      .values({
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
        segment: "new",
      })
      .returning();
    guest = row;
    createdGuest = true;
  } else if (!guest.phone && input.phone?.trim()) {
    // A phone booking is often the first time we get their number.
    await db
      .update(customer)
      .set({ phone: input.phone.trim() })
      .where(eq(customer.id, guest.id));
  }

  const result = await createReservation({
    branchId: input.branchId,
    tableId: input.tableId,
    customerId: guest.id,
    name: input.name.trim(),
    email,
    phone: input.phone?.trim() || guest.phone,
    partySize: input.partySize,
    dateKey: input.date,
    time: input.time,
    occasion: input.occasion,
    notes: input.notes ?? null,
    // Staff take walk-ins for the slot that has just begun, and arrange
    // parties larger than the online cap by phone.
    allowPast: true,
    allowOversizeParty: true,
    source: "staff",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  await logActivity(
    "Reservation created",
    `${result.reservation.reference} · ${input.name} · party of ${input.partySize}`,
    staff,
  );

  return NextResponse.json({
    ok: true,
    reservation: result.reservation,
    table: result.table,
    createdGuest,
    customerId: guest.id,
  });
}
