import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customer,
  customerVoucher,
  loyaltyRedemption,
  loyaltyTier,
  pointsLedger,
  voucher as voucherTable,
} from "@/db/schema";
import { notify } from "./notify";
import { tierFor } from "./pricing";
import { round2 } from "./utils";

const MONTH = 30 * 86_400_000;

/**
 * Points model
 * ------------
 * `points_ledger` is append-only and is the source of truth.
 *   earn rows  : positive points, pending -> active -> expired | clawed_back
 *   spend rows : negative points, state "redeemed"
 *
 * Balance  = active earns + redeemed spends (spends are negative).
 * Tier pts = positive earns in a rolling 12-month window (spending doesn't
 *            demote you; only the window rolling forward does).
 */

export async function awardPoints(opts: {
  customerId: number;
  orderId: number;
  points: number;
  expiryMonths?: number;
  reason?: string;
}) {
  if (opts.points <= 0) return;
  const expiresAt = new Date(
    Date.now() + (opts.expiryMonths ?? 18) * MONTH,
  );
  await db.insert(pointsLedger).values({
    customerId: opts.customerId,
    orderId: opts.orderId,
    points: opts.points,
    state: "pending",
    reason: opts.reason ?? "order",
    expiresAt,
  });
}

/** Called when an order reaches `completed`: pending earns become spendable. */
export async function activatePointsForOrder(orderId: number) {
  const rows = await db
    .select()
    .from(pointsLedger)
    .where(
      and(eq(pointsLedger.orderId, orderId), eq(pointsLedger.state, "pending")),
    );
  if (rows.length === 0) return;

  await db
    .update(pointsLedger)
    .set({ state: "active" })
    .where(
      and(eq(pointsLedger.orderId, orderId), eq(pointsLedger.state, "pending")),
    );

  for (const row of rows) {
    await recomputeLoyalty(row.customerId);
    await notify({
      customerId: row.customerId,
      orderId,
      kind: "loyalty",
      title: `${row.points} points added`,
      message: `Your ${row.points} Bella Rewards points are now available to spend.`,
      href: "/account/rewards",
    });
  }
}

/** Refund / cancel: the earn is voided. */
export async function clawbackPointsForOrder(orderId: number) {
  const rows = await db
    .select()
    .from(pointsLedger)
    .where(
      and(
        eq(pointsLedger.orderId, orderId),
        inArray(pointsLedger.state, ["pending", "active"]),
      ),
    );
  if (rows.length === 0) return;
  await db
    .update(pointsLedger)
    .set({ state: "clawed_back" })
    .where(
      and(
        eq(pointsLedger.orderId, orderId),
        inArray(pointsLedger.state, ["pending", "active"]),
      ),
    );
  for (const row of rows) await recomputeLoyalty(row.customerId);
}

export async function balanceFor(customerId: number) {
  const rows = await db
    .select()
    .from(pointsLedger)
    .where(
      and(
        eq(pointsLedger.customerId, customerId),
        inArray(pointsLedger.state, ["active", "redeemed"]),
      ),
    );
  return rows.reduce((s, r) => s + r.points, 0);
}

export async function pendingFor(customerId: number) {
  const rows = await db
    .select()
    .from(pointsLedger)
    .where(
      and(
        eq(pointsLedger.customerId, customerId),
        eq(pointsLedger.state, "pending"),
      ),
    );
  return rows.reduce((s, r) => s + r.points, 0);
}

/** Rewrites the denormalised balance + tier on the customer row. */
export async function recomputeLoyalty(customerId: number) {
  const rows = await db
    .select()
    .from(pointsLedger)
    .where(eq(pointsLedger.customerId, customerId));

  const balance = rows
    .filter((r) => r.state === "active" || r.state === "redeemed")
    .reduce((s, r) => s + r.points, 0);

  const windowStart = Date.now() - 365 * 86_400_000;
  const tierPoints = rows
    .filter(
      (r) =>
        r.points > 0 &&
        (r.state === "active" || r.state === "redeemed") &&
        r.createdAt.getTime() >= windowStart,
    )
    .reduce((s, r) => s + r.points, 0);

  const tiers = await db.select().from(loyaltyTier).orderBy(loyaltyTier.minPoints);
  const tier = tierFor(tiers, tierPoints);

  await db
    .update(customer)
    .set({
      loyaltyPoints: Math.max(0, balance),
      tierPoints,
      tierId: tier?.id ?? null,
    })
    .where(eq(customer.id, customerId));

  return { balance: Math.max(0, balance), tierPoints, tier };
}

/** Points about to lapse, with the 90/30-day warning flags. */
export async function expiringSoon(customerId: number) {
  const rows = await db
    .select()
    .from(pointsLedger)
    .where(
      and(
        eq(pointsLedger.customerId, customerId),
        eq(pointsLedger.state, "active"),
      ),
    )
    .orderBy(pointsLedger.expiresAt);

  const in90 = Date.now() + 90 * 86_400_000;
  return rows.filter((r) => r.expiresAt && r.expiresAt.getTime() <= in90);
}

/**
 * Sweeps lapsed points and fires the 90/30-day in-app warnings.
 * Invoked lazily whenever a customer views their rewards, and by the admin
 * "run maintenance" action — no cron needed for a demo.
 */
export async function runPointsMaintenance(customerId?: number) {
  const now = new Date();
  const where = customerId
    ? and(
        eq(pointsLedger.state, "active"),
        eq(pointsLedger.customerId, customerId),
      )
    : eq(pointsLedger.state, "active");

  const rows = await db.select().from(pointsLedger).where(where);
  const touched = new Set<number>();

  for (const row of rows) {
    if (!row.expiresAt) continue;
    const daysLeft = Math.floor(
      (row.expiresAt.getTime() - now.getTime()) / 86_400_000,
    );

    if (daysLeft <= 0) {
      await db
        .update(pointsLedger)
        .set({ state: "expired" })
        .where(eq(pointsLedger.id, row.id));
      touched.add(row.customerId);
      await notify({
        customerId: row.customerId,
        kind: "loyalty",
        title: `${row.points} points expired`,
        message: `${row.points} points reached their 18-month expiry. Earn more on your next order.`,
        href: "/account/rewards",
      });
      continue;
    }

    if (daysLeft <= 30 && !row.warned30At) {
      await db
        .update(pointsLedger)
        .set({ warned30At: now })
        .where(eq(pointsLedger.id, row.id));
      await notify({
        customerId: row.customerId,
        kind: "loyalty",
        title: `${row.points} points expire in ${daysLeft} days`,
        message: `Use them before they lapse — RM15 off starts at just 200 points.`,
        href: "/account/rewards",
      });
    } else if (daysLeft <= 90 && !row.warned90At) {
      await db
        .update(pointsLedger)
        .set({ warned90At: now })
        .where(eq(pointsLedger.id, row.id));
      await notify({
        customerId: row.customerId,
        kind: "loyalty",
        title: `${row.points} points expire in ${daysLeft} days`,
        message: `A heads-up so nothing goes to waste — browse the rewards catalogue.`,
        href: "/account/rewards",
      });
    }
  }

  for (const id of touched) await recomputeLoyalty(id);
  return { swept: touched.size };
}

/* -------------------------------------------------------------------------- */
/*  Redemption catalogue                                                      */
/* -------------------------------------------------------------------------- */

function rewardCode(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/** Trades points for a personal, single-use voucher. */
export async function redeemReward(customerId: number, redemptionId: number) {
  const [reward] = await db
    .select()
    .from(loyaltyRedemption)
    .where(eq(loyaltyRedemption.id, redemptionId));
  if (!reward || !reward.active) return { ok: false as const, error: "That reward is unavailable." };

  const balance = await balanceFor(customerId);
  if (balance < reward.pointsCost) {
    return {
      ok: false as const,
      error: `You need ${reward.pointsCost - balance} more points.`,
    };
  }

  const expiresAt = new Date(Date.now() + reward.validDays * 86_400_000);
  const code = rewardCode("REW");

  const [created] = await db
    .insert(voucherTable)
    .values({
      code,
      title: reward.name,
      description: `Redeemed with ${reward.pointsCost} Bella Rewards points`,
      type: reward.rewardType,
      value: reward.rewardValue,
      minSpend: reward.minSpend,
      freeItemId: reward.freeItemId,
      validFrom: new Date(),
      validTo: expiresAt,
      usageLimit: 1,
      perCustomerLimit: 1,
      stackable: false,
      targeted: true,
      active: true,
    })
    .returning();

  await db.insert(customerVoucher).values({
    customerId,
    voucherId: created.id,
    source: "loyalty",
    expiresAt,
  });

  await db.insert(pointsLedger).values({
    customerId,
    points: -reward.pointsCost,
    state: "redeemed",
    reason: `Redeemed: ${reward.name}`,
  });

  await recomputeLoyalty(customerId);

  await notify({
    customerId,
    kind: "voucher",
    title: `${reward.name} unlocked`,
    message: `Your code is ${code} — it's already in My offers and expires in ${reward.validDays} days.`,
    href: "/account/offers",
  });

  return { ok: true as const, code, voucherId: created.id };
}

/** Owner action: hand a bespoke voucher to one customer from their CRM profile. */
export async function issueManualVoucher(opts: {
  customerId: number;
  type: "percent_off" | "fixed_off" | "free_item" | "free_delivery";
  value: number;
  minSpend: number;
  expiryDays: number;
  title?: string;
  freeItemId?: number | null;
  source?: "manual" | "campaign" | "birthday" | "referral" | "review";
  campaignId?: number | null;
  notifyCustomer?: boolean;
}) {
  const expiresAt = new Date(Date.now() + opts.expiryDays * 86_400_000);
  const label =
    opts.title ??
    (opts.type === "percent_off"
      ? `${opts.value}% off your next order`
      : opts.type === "fixed_off"
        ? `$${round2(opts.value).toFixed(2)} off your next order`
        : opts.type === "free_delivery"
          ? "Free delivery on your next order"
          : "A gift from Bella Cucina");

  const [created] = await db
    .insert(voucherTable)
    .values({
      code: rewardCode("BC"),
      title: label,
      description: "Issued personally by Bella Cucina",
      type: opts.type,
      value: opts.value,
      minSpend: opts.minSpend,
      freeItemId: opts.freeItemId ?? null,
      validFrom: new Date(),
      validTo: expiresAt,
      usageLimit: 1,
      perCustomerLimit: 1,
      stackable: false,
      targeted: true,
      active: true,
    })
    .returning();

  await db.insert(customerVoucher).values({
    customerId: opts.customerId,
    voucherId: created.id,
    source: opts.source ?? "manual",
    campaignId: opts.campaignId ?? null,
    expiresAt,
  });

  if (opts.notifyCustomer !== false) {
    await notify({
      customerId: opts.customerId,
      kind: "voucher",
      title: label,
      message: `Use code ${created.code} at checkout${
        opts.minSpend > 0 ? ` on orders over $${opts.minSpend.toFixed(2)}` : ""
      }. Valid until ${expiresAt.toLocaleDateString()}.`,
      href: "/account/offers",
    });
  }

  return created;
}

/** Vouchers a signed-in customer can actually use right now. */
export async function offersFor(customerId: number) {
  const rows = await db
    .select({ issued: customerVoucher, voucher: voucherTable })
    .from(customerVoucher)
    .innerJoin(voucherTable, eq(customerVoucher.voucherId, voucherTable.id))
    .where(eq(customerVoucher.customerId, customerId))
    .orderBy(desc(customerVoucher.createdAt));

  const now = Date.now();
  return rows.map((r) => {
    const expiry = r.issued.expiresAt ?? r.voucher.validTo;
    const expired = !!expiry && expiry.getTime() < now;
    return {
      ...r,
      expiry,
      expired,
      used: !!r.issued.redeemedAt,
      daysLeft: expiry
        ? Math.max(0, Math.ceil((expiry.getTime() - now) / 86_400_000))
        : null,
    };
  });
}

/** Public (non-targeted) vouchers anyone can try — shown on the offers page. */
export async function publicOffers() {
  const now = new Date();
  return db
    .select()
    .from(voucherTable)
    .where(
      and(
        eq(voucherTable.active, true),
        eq(voucherTable.targeted, false),
        sql`(${voucherTable.validTo} is null or ${voucherTable.validTo} >= ${Math.floor(
          now.getTime() / 1000,
        )})`,
      ),
    );
}

export async function ledgerFor(customerId: number, limit = 50) {
  return db
    .select()
    .from(pointsLedger)
    .where(eq(pointsLedger.customerId, customerId))
    .orderBy(desc(pointsLedger.createdAt))
    .limit(limit);
}

export { gte, lte, isNull };
