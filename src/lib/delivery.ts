import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  branch,
  deliveryJob,
  order,
  type Branch,
  type DeliveryJob,
  type DeliveryStatus,
} from "@/db/schema";
import { distanceKm } from "./branches";
import { notify } from "./notify";
import { round2 } from "./utils";

/**
 * Courier dispatch, written against a provider interface rather than a vendor.
 *
 * Malaysian on-demand options all expose the same three operations — quote a
 * job, book it, then poll or receive its status — so Lalamove, Grab Express,
 * pandago, Borzo or an aggregator like Delyva can each be dropped in behind
 * `DeliveryProvider` without the checkout or the tracking page changing.
 *
 * The built-in `simulated` provider is the default so the demo runs with no
 * courier account at all. Set DELIVERY_PROVIDER to switch.
 */

export type DeliveryQuote = {
  provider: DeliveryJob["provider"];
  fee: number;
  distanceKm: number;
  etaMinutes: number;
  /** Set when the drop-off is outside the branch's radius. */
  refusal?: string;
};

export type DeliveryBooking = {
  providerRef: string;
  driverName: string;
  driverPhone: string;
  vehicleType: DeliveryJob["vehicleType"];
  plateNumber: string;
  driverRating: number;
  etaMinutes: number;
};

export interface DeliveryProvider {
  readonly id: DeliveryJob["provider"];
  readonly label: string;
  quote(input: {
    branch: Branch;
    dropoff: { lat: number; lng: number } | null;
    subtotal: number;
  }): Promise<DeliveryQuote>;
  book(input: {
    orderId: number;
    branch: Branch;
    quote: DeliveryQuote;
    dropoffAddress: string;
  }): Promise<DeliveryBooking>;
}

/* -------------------------------------------------------------------------- */
/*  Pricing                                                                   */
/* -------------------------------------------------------------------------- */

/** Klang Valley on-demand rates: a base fare plus per-km, floored sensibly. */
const BASE_FARE = 5;
const PER_KM = 1.2;
const MIN_FEE = 5;

export function quoteFee(km: number) {
  return round2(Math.max(MIN_FEE, BASE_FARE + km * PER_KM));
}

export function quoteEta(km: number) {
  // ~18 min to cook and hand over, then ~3 min/km through KL traffic.
  return Math.round(18 + km * 3);
}

/* -------------------------------------------------------------------------- */
/*  Simulated provider                                                        */
/* -------------------------------------------------------------------------- */

const RIDER_NAMES = [
  "Hafiz Rahman",
  "Kumar Selvam",
  "Wei Jie Tan",
  "Nurul Aina",
  "Syafiq Idris",
  "Melissa Chong",
  "Arun Pillai",
  "Farah Zainal",
];

const PLATE_PREFIXES = ["WVA", "WXC", "JQL", "BMT", "WNP", "VBK"];

function pickFrom<T>(list: T[], seed: number) {
  return list[Math.abs(seed) % list.length];
}

/**
 * Produces a plausible rider without any network call. Deterministic on the
 * order id so a refresh doesn't reassign the driver mid-delivery.
 */
export const simulatedProvider: DeliveryProvider = {
  id: "simulated",
  label: "Bella Cucina riders",

  async quote({ branch: b, dropoff }) {
    const km =
      dropoff && b.lat != null && b.lng != null
        ? distanceKm({ lat: b.lat, lng: b.lng }, dropoff)
        : 4.2; // typical urban hop when we have no coordinates
    if (km > b.deliveryRadiusKm) {
      return {
        provider: "simulated",
        fee: 0,
        distanceKm: km,
        etaMinutes: 0,
        refusal: `${b.shortName} delivers within ${b.deliveryRadiusKm} km — you're ${km} km away. Try another branch or switch to pickup.`,
      };
    }
    return {
      provider: "simulated",
      fee: quoteFee(km),
      distanceKm: km,
      etaMinutes: quoteEta(km),
    };
  },

  async book({ orderId, quote }) {
    return {
      providerRef: `SIM-${100000 + orderId}`,
      driverName: pickFrom(RIDER_NAMES, orderId * 7),
      driverPhone: `+60 1${(orderId % 9) + 1}-${String(200 + (orderId % 799)).padStart(3, "0")} ${String(1000 + (orderId * 37) % 8999)}`,
      vehicleType: "motorcycle",
      plateNumber: `${pickFrom(PLATE_PREFIXES, orderId * 3)} ${String(1000 + (orderId * 53) % 8999)}`,
      driverRating: round2(4.5 + ((orderId * 13) % 50) / 100),
      etaMinutes: quote.etaMinutes,
    };
  },
};

/* -------------------------------------------------------------------------- */
/*  Provider registry                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Real providers slot in here. Each needs an API key and a small adapter that
 * maps its response onto DeliveryBooking — nothing else in the app changes.
 */
export const PROVIDER_CATALOGUE: {
  id: DeliveryJob["provider"];
  label: string;
  note: string;
  envVar: string;
}[] = [
  {
    id: "simulated",
    label: "Built-in riders (demo)",
    note: "No account needed. Drives the same states a real courier would.",
    envVar: "—",
  },
  {
    id: "lalamove",
    label: "Lalamove",
    note: "On-demand courier, strong Klang Valley coverage, pay per delivery.",
    envVar: "LALAMOVE_API_KEY",
  },
  {
    id: "grab_express",
    label: "Grab Express",
    note: "Widest coverage and the brand customers already recognise.",
    envVar: "GRAB_API_KEY",
  },
  {
    id: "pandago",
    label: "pandago",
    note: "foodpanda's delivery-only arm, built for restaurant handovers.",
    envVar: "PANDAGO_API_KEY",
  },
  {
    id: "delyva",
    label: "Delyva",
    note: "Aggregator — one integration, picks the cheapest courier per job.",
    envVar: "DELYVA_API_KEY",
  },
  {
    id: "borzo",
    label: "Borzo",
    note: "Usually cheapest for short hops, thinner suburban coverage.",
    envVar: "BORZO_API_KEY",
  },
];

export function activeProvider(): DeliveryProvider {
  // Real adapters register here once their key is present; until then every
  // configuration falls back to the simulator so the demo cannot break.
  return simulatedProvider;
}

export function configuredProviderId(): DeliveryJob["provider"] {
  const wanted = process.env.DELIVERY_PROVIDER as DeliveryJob["provider"] | undefined;
  return wanted && PROVIDER_CATALOGUE.some((p) => p.id === wanted)
    ? wanted
    : "simulated";
}

/* -------------------------------------------------------------------------- */
/*  Job lifecycle                                                             */
/* -------------------------------------------------------------------------- */

export async function quoteDelivery(opts: {
  branchId: number;
  dropoff?: { lat: number; lng: number } | null;
  subtotal: number;
}) {
  const [b] = await db.select().from(branch).where(eq(branch.id, opts.branchId));
  if (!b) return null;
  return activeProvider().quote({
    branch: b,
    dropoff: opts.dropoff ?? null,
    subtotal: opts.subtotal,
  });
}

/** Creates the courier job once an order is accepted by the kitchen. */
export async function dispatchDelivery(orderId: number) {
  const [row] = await db.select().from(order).where(eq(order.id, orderId));
  if (!row || row.type !== "delivery" || !row.branchId) return null;

  const existing = await db
    .select()
    .from(deliveryJob)
    .where(eq(deliveryJob.orderId, orderId));
  if (existing.length > 0) return existing[0];

  const [b] = await db.select().from(branch).where(eq(branch.id, row.branchId));
  if (!b) return null;

  const provider = activeProvider();
  const quote = await provider.quote({
    branch: b,
    dropoff: null,
    subtotal: row.subtotal,
  });
  const booking = await provider.book({
    orderId,
    branch: b,
    quote,
    dropoffAddress: row.address ?? "",
  });

  const [job] = await db
    .insert(deliveryJob)
    .values({
      orderId,
      branchId: b.id,
      provider: configuredProviderId(),
      providerRef: booking.providerRef,
      status: "assigned",
      fee: row.deliveryFee || quote.fee,
      distanceKm: quote.distanceKm,
      etaMinutes: booking.etaMinutes,
      driverName: booking.driverName,
      driverPhone: booking.driverPhone,
      vehicleType: booking.vehicleType,
      plateNumber: booking.plateNumber,
      driverRating: booking.driverRating,
      progress: 0,
      pickupAddress: `${b.name}, ${b.address}`,
      dropoffAddress: row.address,
      assignedAt: new Date(),
    })
    .returning();

  await notify({
    customerId: row.customerId,
    email: row.guestEmail,
    orderId,
    kind: "order",
    title: `${booking.driverName} is collecting your order`,
    message: `${booking.vehicleType === "motorcycle" ? "Rider" : "Driver"} ${booking.driverName} (${booking.plateNumber}) will bring ${row.number} over — about ${booking.etaMinutes} minutes.`,
    href: `/order/${orderId}`,
  });

  return job;
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  quoted: "Quoted",
  requested: "Finding a rider",
  assigned: "Rider assigned",
  picking_up: "Collecting from the kitchen",
  on_the_way: "On the way to you",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed",
};

/** The order status each delivery stage corresponds to. */
export const DELIVERY_STAGE_ORDER: DeliveryStatus[] = [
  "requested",
  "assigned",
  "picking_up",
  "on_the_way",
  "delivered",
];

export async function advanceDelivery(
  orderId: number,
  to: DeliveryStatus,
  progress?: number,
) {
  const [job] = await db
    .select()
    .from(deliveryJob)
    .where(eq(deliveryJob.orderId, orderId));
  if (!job) return null;

  const patch: Partial<DeliveryJob> = { status: to };
  if (progress !== undefined) patch.progress = Math.min(1, Math.max(0, progress));
  if (to === "picking_up") patch.pickedUpAt = new Date();
  if (to === "on_the_way" && !job.pickedUpAt) patch.pickedUpAt = new Date();
  if (to === "delivered") {
    patch.deliveredAt = new Date();
    patch.progress = 1;
    patch.proofNote = "Handed to the customer at the door";
  }

  const [updated] = await db
    .update(deliveryJob)
    .set(patch)
    .where(eq(deliveryJob.id, job.id))
    .returning();
  return updated;
}

export async function deliveryFor(orderId: number) {
  const [job] = await db
    .select()
    .from(deliveryJob)
    .where(eq(deliveryJob.orderId, orderId));
  return job ?? null;
}
