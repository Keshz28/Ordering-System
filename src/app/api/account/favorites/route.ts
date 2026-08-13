import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { favorite } from "@/db/schema";
import { currentCustomer } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({ menuItemId: z.number() });

/** Toggles a favourite; returns the resulting state. */
export async function POST(request: Request) {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json(
      { error: "Sign in to save favourites." },
      { status: 401 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid item." }, { status: 400 });
  }

  const where = and(
    eq(favorite.customerId, customer.id),
    eq(favorite.menuItemId, parsed.data.menuItemId),
  );

  const [existing] = await db.select().from(favorite).where(where);
  if (existing) {
    await db.delete(favorite).where(where);
    return NextResponse.json({ saved: false });
  }

  await db
    .insert(favorite)
    .values({ customerId: customer.id, menuItemId: parsed.data.menuItemId });
  return NextResponse.json({ saved: true });
}
