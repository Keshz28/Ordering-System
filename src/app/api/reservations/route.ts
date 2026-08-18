import { NextResponse } from "next/server";
import { z } from "zod";
import { currentCustomer } from "@/lib/auth";
import { cancelReservation, createReservation } from "@/lib/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  branchId: z.number().int().positive(),
  tableId: z.number().int().positive(),
  partySize: z.number().int().min(1).max(30),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  occasion: z
    .enum(["none", "birthday", "anniversary", "business", "date", "celebration"])
    .optional(),
  notes: z.string().max(400).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
});

/**
 * Booking requires an account — the guest's name and email come from the
 * session rather than the request body, so a booking can never be made in
 * someone else's name.
 */
export async function POST(request: Request) {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json(
      { error: "Sign in to book a table.", needsAuth: true },
      { status: 401 },
    );
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid booking details." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const result = await createReservation({
    branchId: input.branchId,
    tableId: input.tableId,
    customerId: customer.id,
    name: customer.name,
    email: customer.email,
    phone: input.phone ?? customer.phone,
    partySize: input.partySize,
    dateKey: input.date,
    time: input.time,
    occasion: input.occasion,
    notes: input.notes ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    reservation: result.reservation,
    table: result.table,
    branch: result.branch,
  });
}

export async function DELETE(request: Request) {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "Reservation id required." }, { status: 400 });
  }

  const result = await cancelReservation(id, { customerId: customer.id });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
