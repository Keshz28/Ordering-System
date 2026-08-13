import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

/**
 * A single signed-cookie session layer covering both audiences:
 *   - staff  (email + password, role-gated)
 *   - customer (passwordless 6-digit email code)
 *
 * Deliberately hand-rolled rather than next-auth: the customer flow is a custom
 * OTP grant, Lucia is discontinued, and two parallel session systems would be
 * worse than one small one. Role checks live in auth.ts and always run on the
 * server — see requireStaff().
 */

const STAFF_COOKIE = "bc_staff";
const CUSTOMER_COOKIE = "bc_customer";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type StaffSession = {
  id: number;
  name: string;
  email: string;
  role: "owner" | "manager" | "cashier" | "kitchen";
};

export type CustomerSession = {
  id: number;
  name: string;
  email: string;
};

function secret() {
  const raw =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "bella-cucina-development-only-secret-change-me";
  return new TextEncoder().encode(raw);
}

async function sign(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

async function read<T>(name: string): Promise<T | null> {
  const store = await cookies();
  const token = store.get(name)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as T;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
  secure: process.env.NODE_ENV === "production",
};

export async function setStaffSession(session: StaffSession) {
  const store = await cookies();
  store.set(STAFF_COOKIE, await sign({ ...session }), cookieOptions);
}

export async function getStaffSession() {
  return read<StaffSession & { exp: number }>(STAFF_COOKIE);
}

export async function clearStaffSession() {
  (await cookies()).delete(STAFF_COOKIE);
}

export async function setCustomerSession(session: CustomerSession) {
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, await sign({ ...session }), cookieOptions);
}

export async function getCustomerSession() {
  return read<CustomerSession & { exp: number }>(CUSTOMER_COOKIE);
}

export async function clearCustomerSession() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}
