import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customer, loginToken } from "@/db/schema";
import {
  emailEnabled,
  loginCodeEmail,
  notify,
  sendEmail,
} from "@/lib/notify";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  name: z.string().optional(),
});

const CODE_TTL_MINUTES = 10;

/**
 * Issues a 6-digit login code.
 *
 * Delivery is deliberately layered so the demo needs zero configuration:
 *   1. always written to the in-app Inbox,
 *   2. always returned in the response so the UI can show it on screen,
 *   3. additionally emailed via Resend when RESEND_API_KEY is set.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();

  // Throttle: reuse a live code rather than minting a second one.
  const [live] = await db
    .select()
    .from(loginToken)
    .where(and(eq(loginToken.email, email), gt(loginToken.expiresAt, new Date())));

  const code =
    live && !live.consumedAt
      ? live.code
      : String(Math.floor(100000 + Math.random() * 900000));

  if (!live || live.consumedAt) {
    await db.insert(loginToken).values({
      email,
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    });
  }

  const [existing] = await db
    .select()
    .from(customer)
    .where(eq(customer.email, email));

  await notify({
    customerId: existing?.id ?? null,
    email,
    kind: "login",
    channel: emailEnabled() ? "email" : "in_app",
    title: "Your Bella Cucina sign-in code",
    message: `Enter ${code} to sign in. The code expires in ${CODE_TTL_MINUTES} minutes.`,
    href: "/login",
  });

  const mail = emailEnabled()
    ? await sendEmail({
        to: email,
        subject: `${code} is your Bella Cucina sign-in code`,
        html: loginCodeEmail(code),
      })
    : { sent: false as const };

  return NextResponse.json({
    ok: true,
    email,
    emailSent: mail.sent,
    // Shown on screen in demo mode; suppressed once real email is configured.
    code: mail.sent ? null : code,
    isNewCustomer: !existing,
    expiresInMinutes: CODE_TTL_MINUTES,
  });
}
