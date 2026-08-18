import { and, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  branch,
  reservation,
  restaurantTable,
  type Branch,
  type Reservation,
  type RestaurantTable,
  type Settings,
} from "@/db/schema";
import { hoursForDate, to12h } from "./branches";
import { notify } from "./notify";
import { getSettings } from "./pricing";
import { minutesOfDay } from "./utils";

/**
 * Availability is derived, not stored.
 *
 * A table is free for a slot when no other live reservation on that table
 * overlaps [start, end). That keeps seating length flexible (a party of ten can
 * hold a table for two hours while a two-top turns in ninety minutes) and
 * means there is no slot table to keep in sync.
 */

/** Reservations that still hold a table. Cancelled and no-show release it. */
const LIVE_STATUSES = ["confirmed", "seated"] as const;

export type Slot = {
  /** "18:30" */
  time: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
  /** Tables free at this time that also fit the party. */
  availableTables: number;
  isPast: boolean;
};

export type TableAvailability = {
  table: RestaurantTable;
  /** Free, and big enough for the party. */
  available: boolean;
  reason: "available" | "booked" | "too_small" | "oversized" | "not_bookable";
};

/* -------------------------------------------------------------------------- */
/*  Dates                                                                     */
/* -------------------------------------------------------------------------- */

/** Local YYYY-MM-DD; avoids the UTC shift that toISOString() introduces. */
export function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function bookableDates(settings: Settings, from = new Date()) {
  const out: { key: string; date: Date }[] = [];
  for (let i = 0; i < settings.reservationLeadDays; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    out.push({ key: toDateKey(d), date: d });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Slot generation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Slots run from opening until the last seating that still finishes before
 * close, so a booking never runs past the kitchen shutting.
 */
export function slotTimesFor(b: Branch, date: Date, settings: Settings) {
  const today = hoursForDate(b.openingHours, date);
  if (!today || today.closed) return [];

  const open = minutesOfDay(today.open);
  const close = minutesOfDay(today.close);
  const step = settings.reservationSlotMinutes;
  const duration = settings.reservationDurationMinutes;

  const times: string[] = [];
  for (let m = open; m + duration <= close; m += step) {
    times.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    );
  }
  return times;
}

function combine(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
}

/* -------------------------------------------------------------------------- */
/*  Availability                                                              */
/* -------------------------------------------------------------------------- */

async function liveReservationsOn(branchId: number, dateKey: string) {
  return db
    .select()
    .from(reservation)
    .where(
      and(
        eq(reservation.branchId, branchId),
        eq(reservation.date, dateKey),
        inArray(reservation.status, [...LIVE_STATUSES]),
      ),
    );
}

export async function tablesFor(branchId: number) {
  return db
    .select()
    .from(restaurantTable)
    .where(eq(restaurantTable.branchId, branchId))
    .orderBy(restaurantTable.number);
}

function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Which tables can take this party at this time.
 *
 * A table is offered when it seats the party and isn't already held. Tables
 * more than four seats larger than the party are marked `oversized` — still
 * bookable, but de-emphasised, so a couple doesn't casually take the
 * twelve-seat pergola on a Saturday night.
 */
export async function availabilityAt(opts: {
  branchId: number;
  dateKey: string;
  time: string;
  partySize: number;
  settings?: Settings;
  /** Ignore this reservation when checking — used when editing a booking. */
  excludeReservationId?: number;
}): Promise<TableAvailability[]> {
  const settings = opts.settings ?? (await getSettings());
  const date = fromDateKey(opts.dateKey);
  const startsAt = combine(date, opts.time);
  const endsAt = new Date(
    startsAt.getTime() + settings.reservationDurationMinutes * 60_000,
  );

  const [tables, booked] = await Promise.all([
    tablesFor(opts.branchId),
    liveReservationsOn(opts.branchId, opts.dateKey),
  ]);

  const heldTableIds = new Set(
    booked
      .filter((r) => r.id !== opts.excludeReservationId)
      .filter((r) => overlaps(startsAt, endsAt, r.startsAt, r.endsAt))
      .map((r) => r.tableId),
  );

  return tables.map((table) => {
    if (!table.bookable) {
      return { table, available: false, reason: "not_bookable" as const };
    }
    if (heldTableIds.has(table.id)) {
      return { table, available: false, reason: "booked" as const };
    }
    if (table.seats < opts.partySize) {
      return { table, available: false, reason: "too_small" as const };
    }
    if (table.seats > opts.partySize + 4) {
      return { table, available: true, reason: "oversized" as const };
    }
    return { table, available: true, reason: "available" as const };
  });
}

/** Slot strip for a day, each annotated with how many tables remain. */
export async function slotsFor(opts: {
  branchId: number;
  dateKey: string;
  partySize: number;
  settings?: Settings;
}): Promise<Slot[]> {
  const settings = opts.settings ?? (await getSettings());
  const b = (await db.select().from(branch).where(eq(branch.id, opts.branchId)))[0];
  if (!b) return [];

  const date = fromDateKey(opts.dateKey);
  const times = slotTimesFor(b, date, settings);
  const [tables, booked] = await Promise.all([
    tablesFor(opts.branchId),
    liveReservationsOn(opts.branchId, opts.dateKey),
  ]);

  const fitting = tables.filter(
    (t) => t.bookable && t.seats >= opts.partySize,
  );
  const now = Date.now();

  return times.map((time) => {
    const startsAt = combine(date, time);
    const endsAt = new Date(
      startsAt.getTime() + settings.reservationDurationMinutes * 60_000,
    );
    const held = new Set(
      booked
        .filter((r) => overlaps(startsAt, endsAt, r.startsAt, r.endsAt))
        .map((r) => r.tableId),
    );
    return {
      time,
      label: to12h(time),
      startsAt,
      endsAt,
      availableTables: fitting.filter((t) => !held.has(t.id)).length,
      isPast: startsAt.getTime() < now,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Booking                                                                   */
/* -------------------------------------------------------------------------- */

function reservationReference() {
  return `BC-R-${Math.floor(1000 + Math.random() * 9000)}`;
}

export type CreateReservationInput = {
  branchId: number;
  tableId: number;
  customerId: number;
  name: string;
  email: string;
  phone?: string | null;
  partySize: number;
  dateKey: string;
  time: string;
  occasion?: Reservation["occasion"];
  notes?: string | null;
};

export async function createReservation(input: CreateReservationInput) {
  const settings = await getSettings();
  const date = fromDateKey(input.dateKey);
  const startsAt = combine(date, input.time);
  const endsAt = new Date(
    startsAt.getTime() + settings.reservationDurationMinutes * 60_000,
  );

  if (startsAt.getTime() < Date.now()) {
    return { ok: false as const, error: "That time has already passed." };
  }
  if (input.partySize < 1 || input.partySize > settings.reservationMaxPartySize) {
    return {
      ok: false as const,
      error: `Parties of 1 to ${settings.reservationMaxPartySize} can book online. For anything larger, please call the branch.`,
    };
  }

  const [table] = await db
    .select()
    .from(restaurantTable)
    .where(eq(restaurantTable.id, input.tableId));

  if (!table || table.branchId !== input.branchId) {
    return { ok: false as const, error: "That table isn't at this branch." };
  }
  if (!table.bookable) {
    return { ok: false as const, error: "That table isn't available to book." };
  }
  if (table.seats < input.partySize) {
    return {
      ok: false as const,
      error: `Table ${table.number} seats ${table.seats} — choose a larger table for ${input.partySize}.`,
    };
  }

  // Re-check at write time: someone may have taken the table while the guest
  // was filling in the form.
  const clashes = await db
    .select()
    .from(reservation)
    .where(
      and(
        eq(reservation.tableId, input.tableId),
        eq(reservation.date, input.dateKey),
        inArray(reservation.status, [...LIVE_STATUSES]),
      ),
    );

  if (clashes.some((r) => overlaps(startsAt, endsAt, r.startsAt, r.endsAt))) {
    return {
      ok: false as const,
      error: "Sorry — that table was just taken. Please pick another.",
    };
  }

  const [created] = await db
    .insert(reservation)
    .values({
      reference: reservationReference(),
      branchId: input.branchId,
      tableId: input.tableId,
      customerId: input.customerId,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      partySize: input.partySize,
      date: input.dateKey,
      startsAt,
      endsAt,
      durationMinutes: settings.reservationDurationMinutes,
      occasion: input.occasion ?? "none",
      notes: input.notes ?? null,
      status: "confirmed",
    })
    .returning();

  const [b] = await db.select().from(branch).where(eq(branch.id, input.branchId));

  await notify({
    customerId: input.customerId,
    kind: "system",
    title: `Table booked — ${b?.shortName ?? "Bella Cucina"}`,
    message: `${created.reference}: table ${table.number} for ${input.partySize} on ${date.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })} at ${to12h(input.time)}.`,
    href: "/account/reservations",
  });

  return { ok: true as const, reservation: created, table, branch: b ?? null };
}

export async function cancelReservation(
  reservationId: number,
  opts: { customerId?: number; reason?: string } = {},
) {
  const [existing] = await db
    .select()
    .from(reservation)
    .where(eq(reservation.id, reservationId));

  if (!existing) return { ok: false as const, error: "Reservation not found." };
  if (opts.customerId && existing.customerId !== opts.customerId) {
    return { ok: false as const, error: "That isn't your reservation." };
  }
  if (existing.status === "cancelled") {
    return { ok: false as const, error: "Already cancelled." };
  }

  await db
    .update(reservation)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: opts.reason ?? "Cancelled by guest",
    })
    .where(eq(reservation.id, reservationId));

  await notify({
    customerId: existing.customerId,
    kind: "system",
    title: "Reservation cancelled",
    message: `${existing.reference} on ${existing.date} has been cancelled. The table is back in the pool.`,
    href: "/account/reservations",
  });

  return { ok: true as const };
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

export async function reservationsForCustomer(customerId: number) {
  return db
    .select({
      reservation,
      table: restaurantTable,
      branch,
    })
    .from(reservation)
    .innerJoin(restaurantTable, eq(reservation.tableId, restaurantTable.id))
    .innerJoin(branch, eq(reservation.branchId, branch.id))
    .where(eq(reservation.customerId, customerId))
    .orderBy(desc(reservation.startsAt));
}

export async function reservationsOnDate(branchId: number, dateKey: string) {
  return db
    .select({ reservation, table: restaurantTable })
    .from(reservation)
    .innerJoin(restaurantTable, eq(reservation.tableId, restaurantTable.id))
    .where(
      and(eq(reservation.branchId, branchId), eq(reservation.date, dateKey)),
    )
    .orderBy(reservation.startsAt);
}

export async function upcomingReservations(branchId?: number, limit = 50) {
  const base = db
    .select({ reservation, table: restaurantTable, branch })
    .from(reservation)
    .innerJoin(restaurantTable, eq(reservation.tableId, restaurantTable.id))
    .innerJoin(branch, eq(reservation.branchId, branch.id))
    .where(
      branchId
        ? and(
            eq(reservation.branchId, branchId),
            gte(reservation.endsAt, new Date()),
            inArray(reservation.status, [...LIVE_STATUSES]),
          )
        : and(
            gte(reservation.endsAt, new Date()),
            inArray(reservation.status, [...LIVE_STATUSES]),
          ),
    )
    .orderBy(reservation.startsAt)
    .limit(limit);
  return base;
}

export const RESERVATION_STATUS_LABELS: Record<
  Reservation["status"],
  string
> = {
  confirmed: "Confirmed",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

export const OCCASION_LABELS: Record<Reservation["occasion"], string> = {
  none: "No special occasion",
  birthday: "Birthday",
  anniversary: "Anniversary",
  business: "Business meal",
  date: "Date night",
  celebration: "Celebration",
};

export { lt, ne };
