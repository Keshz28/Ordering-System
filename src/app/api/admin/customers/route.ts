import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customer } from "@/db/schema";
import { logActivity, staffGuard } from "@/lib/auth";
import { issueManualVoucher } from "@/lib/loyalty";
import { recomputeAllCustomers, recomputeCustomer } from "@/lib/segments";

export const runtime = "nodejs";

const voucherSchema = z.object({
  action: z.literal("issue_voucher"),
  customerId: z.number(),
  type: z.enum(["percent_off", "fixed_off", "free_item", "free_delivery"]),
  value: z.number().min(0),
  minSpend: z.number().min(0),
  expiryDays: z.number().min(1).max(365),
  title: z.string().optional(),
  freeItemId: z.number().nullable().optional(),
});

const recomputeSchema = z.object({
  action: z.literal("recompute"),
  customerId: z.number().optional(),
});

const noteSchema = z.object({
  action: z.literal("update_profile"),
  customerId: z.number(),
  preferences: z.string().nullable().optional(),
  allergies: z.array(z.string()).optional(),
  marketingOptIn: z.boolean().optional(),
});

const schema = z.discriminatedUnion("action", [
  voucherSchema,
  recomputeSchema,
  noteSchema,
]);

export async function POST(request: Request) {
  const staff = await staffGuard("admin");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const body = parsed.data;

  if (body.action === "recompute") {
    if (body.customerId) {
      const result = await recomputeCustomer(body.customerId);
      return NextResponse.json({ ok: true, ...result });
    }
    const n = await recomputeAllCustomers();
    await logActivity("Recomputed CRM segments", `${n} customers`);
    return NextResponse.json({ ok: true, customers: n });
  }

  if (body.action === "update_profile") {
    const patch: Record<string, unknown> = {};
    if (body.preferences !== undefined) patch.preferences = body.preferences;
    if (body.allergies) patch.allergies = body.allergies;
    if (body.marketingOptIn !== undefined)
      patch.marketingOptIn = body.marketingOptIn;
    await db.update(customer).set(patch).where(eq(customer.id, body.customerId));
    await logActivity("Updated customer profile", `#${body.customerId}`);
    return NextResponse.json({ ok: true });
  }

  // --- issue a personal voucher from the CRM profile ------------------------
  const [target] = await db
    .select()
    .from(customer)
    .where(eq(customer.id, body.customerId));
  if (!target) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const created = await issueManualVoucher({
    customerId: body.customerId,
    type: body.type,
    value: body.value,
    minSpend: body.minSpend,
    expiryDays: body.expiryDays,
    title: body.title,
    freeItemId: body.freeItemId ?? null,
    source: "manual",
  });

  await logActivity(
    "Issued voucher to customer",
    `${created.code} → ${target.email}`,
  );

  return NextResponse.json({
    ok: true,
    code: created.code,
    title: created.title,
    customerEmail: target.email,
  });
}
