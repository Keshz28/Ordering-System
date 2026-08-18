import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { branch, type Branch, type OpeningHours } from "@/db/schema";
import { minutesOfDay } from "./utils";

const BRANCH_COOKIE = "bc_branch";

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export async function listBranches(activeOnly = true) {
  const rows = await db.select().from(branch).orderBy(asc(branch.sortOrder));
  return activeOnly ? rows.filter((b) => b.active) : rows;
}

export async function getBranchBySlug(slug: string) {
  const rows = await db.select().from(branch).where(eq(branch.slug, slug));
  return rows[0] ?? null;
}

export async function getBranchById(id: number) {
  const rows = await db.select().from(branch).where(eq(branch.id, id));
  return rows[0] ?? null;
}

/**
 * The branch the storefront is currently ordering from. Falls back to the
 * first active outlet so the site is never in a broken "no branch" state —
 * a first-time visitor sees Bangsar rather than an empty menu.
 */
export async function currentBranch(): Promise<Branch | null> {
  const store = await cookies();
  const slug = store.get(BRANCH_COOKIE)?.value;
  if (slug) {
    const found = await getBranchBySlug(slug);
    if (found?.active) return found;
  }
  const all = await listBranches();
  return all[0] ?? null;
}

export async function setBranchCookie(slug: string) {
  const store = await cookies();
  store.set(BRANCH_COOKIE, slug, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180,
  });
}

/* -------------------------------------------------------------------------- */
/*  Opening hours                                                             */
/* -------------------------------------------------------------------------- */

export function hoursForDate(hours: OpeningHours | null, date: Date) {
  const key = DAY_KEYS[date.getDay()];
  return hours?.[key] ?? null;
}

export function isOpenAt(b: Branch, at = new Date()) {
  const today = hoursForDate(b.openingHours, at);
  if (!today || today.closed) return false;
  const now = at.getHours() * 60 + at.getMinutes();
  return now >= minutesOfDay(today.open) && now < minutesOfDay(today.close);
}

/** "Open until 10:30 pm" / "Opens 11:00 am" / "Closed today". */
export function openStatusLabel(b: Branch, at = new Date()) {
  const today = hoursForDate(b.openingHours, at);
  if (!today || today.closed) return { open: false, label: "Closed today" };
  if (isOpenAt(b, at)) {
    return { open: true, label: `Open until ${to12h(today.close)}` };
  }
  const now = at.getHours() * 60 + at.getMinutes();
  if (now < minutesOfDay(today.open)) {
    return { open: false, label: `Opens ${to12h(today.open)}` };
  }
  return { open: false, label: "Closed for the night" };
}

export function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/* -------------------------------------------------------------------------- */
/*  Distance                                                                  */
/* -------------------------------------------------------------------------- */

/** Great-circle distance in km — used for delivery quotes and zone checks. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export function nearestBranch(
  branches: Branch[],
  point: { lat: number; lng: number },
) {
  const withCoords = branches.filter((b) => b.lat != null && b.lng != null);
  if (withCoords.length === 0) return null;
  return withCoords
    .map((b) => ({
      branch: b,
      km: distanceKm({ lat: b.lat!, lng: b.lng! }, point),
    }))
    .sort((x, y) => x.km - y.km)[0];
}
