import { db } from "@/db";
import { notification } from "@/db/schema";

type NotifyInput = {
  customerId?: number | null;
  email?: string | null;
  orderId?: number | null;
  campaignId?: number | null;
  title: string;
  message: string;
  kind?: "order" | "campaign" | "loyalty" | "login" | "voucher" | "system";
  channel?: "email" | "sms" | "push" | "in_app";
  href?: string | null;
};

/**
 * Every outbound message lands in the in-app Inbox first — that is what makes
 * the demo work with zero configuration. When RESEND_API_KEY is present the
 * same message is additionally sent as real email.
 */
export async function notify(input: NotifyInput) {
  const [row] = await db
    .insert(notification)
    .values({
      customerId: input.customerId ?? null,
      email: input.email ?? null,
      orderId: input.orderId ?? null,
      campaignId: input.campaignId ?? null,
      title: input.title,
      message: input.message,
      kind: input.kind ?? "system",
      channel: input.channel ?? "in_app",
      href: input.href ?? null,
    })
    .returning();
  return row;
}

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!emailEnabled()) return { sent: false as const, reason: "no_api_key" };
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Bella Cucina <onboarding@resend.dev>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { sent: true as const };
  } catch (error) {
    console.error("[resend] send failed", error);
    return { sent: false as const, reason: "send_failed" };
  }
}

export function loginCodeEmail(code: string) {
  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#FDF9F3;border-radius:16px">
    <p style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#8B1E1E;margin:0 0 8px">Bella Cucina</p>
    <h1 style="font-size:22px;margin:0 0 16px;color:#1c1917">Your sign-in code</h1>
    <p style="color:#57534e;font-size:14px;line-height:1.6;margin:0 0 20px">Enter this code to finish signing in. It expires in 10 minutes.</p>
    <div style="font-size:34px;letter-spacing:.35em;font-weight:700;color:#8B1E1E;background:#fff;border:1px solid #E7D9C4;border-radius:12px;padding:18px;text-align:center">${code}</div>
    <p style="color:#a8a29e;font-size:12px;margin:20px 0 0">If you didn't request this, you can ignore this email.</p>
  </div>`;
}

export function campaignEmail(title: string, body: string, code?: string) {
  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#FDF9F3;border-radius:16px">
    <p style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#8B1E1E;margin:0 0 8px">Bella Cucina</p>
    <h1 style="font-size:22px;margin:0 0 16px;color:#1c1917">${title}</h1>
    <p style="color:#57534e;font-size:15px;line-height:1.7;white-space:pre-line">${body}</p>
    ${
      code
        ? `<div style="margin-top:24px;background:#fff;border:1px dashed #8B1E1E;border-radius:12px;padding:16px;text-align:center">
             <p style="margin:0 0 4px;font-size:12px;color:#78716c">Your code</p>
             <p style="margin:0;font-size:24px;font-weight:700;letter-spacing:.15em;color:#8B1E1E">${code}</p>
           </div>`
        : ""
    }
  </div>`;
}
