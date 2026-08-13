import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { customer, staffActivityLog, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getCustomerSession,
  getStaffSession,
  type StaffSession,
} from "./session";

export type Role = StaffSession["role"];

/**
 * What each role may reach. Enforced on the server in every staff page and
 * route handler — the UI hiding is cosmetic on top of this.
 */
export const ROLE_ACCESS: Record<Role, string[]> = {
  owner: ["admin", "pos", "kds", "settings", "staff"],
  manager: ["admin", "pos", "kds"],
  cashier: ["pos", "kds"],
  kitchen: ["kds"],
};

export function canAccess(role: Role, area: string) {
  return ROLE_ACCESS[role]?.includes(area) ?? false;
}

export function hashPassword(plain: string) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compareSync(plain, hash);
}

/** Redirects to the staff login when unauthenticated, or /staff/denied when out of scope. */
export async function requireStaff(area: string, roles?: Role[]) {
  const session = await getStaffSession();
  if (!session) redirect(`/staff/login?next=${encodeURIComponent("/" + area)}`);
  if (roles && !roles.includes(session.role)) redirect("/staff/denied");
  if (!canAccess(session.role, area)) redirect("/staff/denied");
  return session;
}

/** Route-handler variant: returns null instead of redirecting. */
export async function staffGuard(area: string) {
  const session = await getStaffSession();
  if (!session || !canAccess(session.role, area)) return null;
  return session;
}

export async function currentStaff() {
  const session = await getStaffSession();
  if (!session) return null;
  const rows = await db.select().from(user).where(eq(user.id, session.id));
  return rows[0] ?? null;
}

export async function currentCustomer() {
  const session = await getCustomerSession();
  if (!session) return null;
  const rows = await db
    .select()
    .from(customer)
    .where(eq(customer.id, session.id));
  return rows[0] ?? null;
}

export async function requireCustomer(next = "/account") {
  const c = await currentCustomer();
  if (!c) redirect(`/login?next=${encodeURIComponent(next)}`);
  return c;
}

export async function logActivity(
  action: string,
  detail?: string,
  actor?: { id?: number; name?: string } | null,
) {
  const session = actor ?? (await getStaffSession());
  await db.insert(staffActivityLog).values({
    userId: session?.id ?? null,
    userName: session?.name ?? "System",
    action,
    detail: detail ?? null,
  });
}
