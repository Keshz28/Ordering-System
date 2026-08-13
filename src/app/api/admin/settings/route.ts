import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { deliveryZone, promotion, settings } from "@/db/schema";
import { logActivity, staffGuard } from "@/lib/auth";

export const runtime = "nodejs";

const settingsSchema = z.object({
  entity: z.literal("settings"),
  restaurantName: z.string().min(1).optional(),
  tagline: z.string().optional(),
  currencySymbol: z.string().max(3).optional(),
  serviceChargeRate: z.number().min(0).max(0.5).optional(),
  taxRate: z.number().min(0).max(0.5).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  openingHours: z
    .record(
      z.string(),
      z.object({
        open: z.string(),
        close: z.string(),
        closed: z.boolean().optional(),
      }),
    )
    .optional(),
  referralEnabled: z.boolean().optional(),
  referralValue: z.number().min(0).optional(),
});

const zoneSchema = z.object({
  entity: z.literal("zone"),
  id: z.number(),
  fee: z.number().min(0).optional(),
  minOrder: z.number().min(0).optional(),
  etaMinutes: z.number().min(5).max(180).optional(),
  active: z.boolean().optional(),
});

const promoSchema = z.object({
  entity: z.literal("promotion"),
  id: z.number(),
  active: z.boolean(),
});

const schema = z.discriminatedUnion("entity", [
  settingsSchema,
  zoneSchema,
  promoSchema,
]);

export async function PATCH(request: Request) {
  // Settings are owner-only; managers can run the business but not reprice it.
  const staff = await staffGuard("settings");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid settings." },
      { status: 400 },
    );
  }

  if (parsed.data.entity === "settings") {
    const { entity, ...patch } = parsed.data;
    void entity;
    await db.update(settings).set(patch).where(eq(settings.id, 1));
    await logActivity("Updated business settings", Object.keys(patch).join(", "));
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.entity === "zone") {
    const { entity, id, ...patch } = parsed.data;
    void entity;
    await db.update(deliveryZone).set(patch).where(eq(deliveryZone.id, id));
    await logActivity("Updated delivery zone", `#${id}`);
    return NextResponse.json({ ok: true });
  }

  await db
    .update(promotion)
    .set({ active: parsed.data.active })
    .where(eq(promotion.id, parsed.data.id));
  await logActivity(
    "Toggled promotion",
    `#${parsed.data.id} → ${parsed.data.active ? "on" : "off"}`,
  );
  return NextResponse.json({ ok: true });
}
