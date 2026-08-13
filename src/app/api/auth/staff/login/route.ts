import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { logActivity, ROLE_ACCESS, verifyPassword } from "@/lib/auth";
import { setStaffSession } from "@/lib/session";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Landing page per role — kitchen staff should never see the admin shell. */
const HOME_BY_ROLE = {
  owner: "/admin",
  manager: "/admin",
  cashier: "/pos",
  kitchen: "/kds",
} as const;

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your email and password." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const [account] = await db.select().from(user).where(eq(user.email, email));

  // Same message either way so the form can't be used to enumerate accounts.
  if (!account || !verifyPassword(parsed.data.password, account.passwordHash)) {
    return NextResponse.json(
      { error: "That email and password don't match." },
      { status: 401 },
    );
  }

  if (!account.active) {
    return NextResponse.json(
      { error: "This account has been deactivated." },
      { status: 403 },
    );
  }

  await setStaffSession({
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
  });

  await logActivity("Signed in", `${account.role} · ${account.email}`, {
    id: account.id,
    name: account.name,
  });

  return NextResponse.json({
    ok: true,
    role: account.role,
    name: account.name,
    home: HOME_BY_ROLE[account.role],
    access: ROLE_ACCESS[account.role],
  });
}
