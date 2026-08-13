import { NextResponse } from "next/server";
import { z } from "zod";
import { currentCustomer } from "@/lib/auth";
import { redeemReward } from "@/lib/loyalty";

export const runtime = "nodejs";

const schema = z.object({ redemptionId: z.number() });

export async function POST(request: Request) {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json(
      { error: "Sign in to redeem points." },
      { status: 401 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reward." }, { status: 400 });
  }

  const result = await redeemReward(customer.id, parsed.data.redemptionId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
