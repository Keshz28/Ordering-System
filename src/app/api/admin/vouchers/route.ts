import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { voucher } from "@/db/schema";
import { logActivity, staffGuard } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  code: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, dashes or underscores."),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.enum(["percent_off", "fixed_off", "free_item", "free_delivery"]),
  value: z.number().min(0),
  minSpend: z.number().min(0),
  freeItemId: z.number().nullable().optional(),
  orderTypes: z.array(z.enum(["dine_in", "takeout", "delivery"])).min(1),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  usageLimit: z.number().nullable().optional(),
  perCustomerLimit: z.number().nullable().optional(),
  stackable: z.boolean(),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const staff = await staffGuard("admin");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the voucher fields." },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const code = data.code.toUpperCase();

  const [clash] = await db
    .select()
    .from(voucher)
    .where(eq(voucher.code, code));
  if (clash) {
    return NextResponse.json(
      { error: `${code} is already in use.` },
      { status: 409 },
    );
  }

  if (data.type === "free_item" && !data.freeItemId) {
    return NextResponse.json(
      { error: "Choose which item is given away." },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(voucher)
    .values({
      ...data,
      code,
      validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
      validTo: data.validTo ? new Date(data.validTo) : null,
      freeItemId: data.freeItemId ?? null,
      targeted: false,
    })
    .returning();

  await logActivity("Created voucher", `${row.code} · ${row.title}`);
  return NextResponse.json(row);
}

export async function PATCH(request: Request) {
  const staff = await staffGuard("admin");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.usageLimit === "number" || body.usageLimit === null)
    patch.usageLimit = body.usageLimit;
  if (typeof body.value === "number") patch.value = body.value;
  if (typeof body.minSpend === "number") patch.minSpend = body.minSpend;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await db.update(voucher).set(patch).where(eq(voucher.id, id));
  await logActivity("Updated voucher", `#${id} ${JSON.stringify(patch)}`);
  return NextResponse.json({ ok: true });
}
