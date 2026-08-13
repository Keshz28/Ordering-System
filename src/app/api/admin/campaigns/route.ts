import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity, staffGuard } from "@/lib/auth";
import { getRecipe, resolveAudience, sendCampaign } from "@/lib/campaigns";

export const runtime = "nodejs";

const previewSchema = z.object({
  action: z.literal("preview"),
  recipeId: z.string().optional(),
  segment: z.string(),
});

const sendSchema = z.object({
  action: z.literal("send"),
  recipeId: z.string().optional(),
  name: z.string().min(1),
  segment: z.string(),
  subject: z.string().min(1),
  body: z.string().min(1),
  channel: z.enum(["email", "sms", "simulated"]),
  includeVoucher: z.boolean().optional(),
  voucher: z
    .object({
      type: z.enum(["percent_off", "fixed_off", "free_item", "free_delivery"]),
      value: z.number().min(0),
      minSpend: z.number().min(0),
      expiryDays: z.number().min(1).max(365),
      title: z.string(),
    })
    .nullable()
    .optional(),
});

const schema = z.discriminatedUnion("action", [previewSchema, sendSchema]);

export async function POST(request: Request) {
  const staff = await staffGuard("admin");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid campaign." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "preview") {
    const audience = await resolveAudience(
      parsed.data.segment,
      parsed.data.recipeId,
    );
    return NextResponse.json({
      count: audience.length,
      sample: audience.slice(0, 8).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        segment: c.segment,
        totalSpent: c.totalSpent,
      })),
    });
  }

  const body = parsed.data;
  const recipe = body.recipeId ? getRecipe(body.recipeId) : null;
  const voucher =
    body.includeVoucher === false
      ? null
      : (body.voucher ?? recipe?.voucher ?? null);

  const result = await sendCampaign({
    name: body.name,
    recipeId: body.recipeId,
    segment: body.segment,
    subject: body.subject,
    body: body.body,
    channel: body.channel,
    voucher,
  });

  if (result.recipients === 0) {
    return NextResponse.json(
      {
        error:
          "Nobody currently matches that audience — try a different segment.",
      },
      { status: 400 },
    );
  }

  await logActivity(
    "Sent campaign",
    `${body.name} → ${result.recipients} recipients`,
  );

  return NextResponse.json(result);
}
