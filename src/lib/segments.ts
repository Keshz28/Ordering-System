import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customer, order, type Customer, type Segment } from "@/db/schema";
import { round2 } from "./utils";

// Labels/styles live in a db-free module so client components can import them.
export {
  SEGMENTS,
  SEGMENT_LABELS,
  SEGMENT_DESCRIPTIONS,
  SEGMENT_STYLES,
} from "./segment-labels";

const REVENUE_STATUSES = [
  "accepted",
  "preparing",
  "ready",
  "dispatched",
  "completed",
] as const;

type Stats = {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  voucherOrders: number;
  aov: number;
};

/**
 * Segment precedence: VIP wins over recency, because a lapsed big spender is
 * still the most valuable person to win back and owners want them grouped with
 * their peers. Everyone else is bucketed by recency first, then frequency.
 */
export function segmentFor(stats: Stats): Segment {
  const daysSilent = stats.lastOrderAt
    ? Math.floor((Date.now() - stats.lastOrderAt.getTime()) / 86_400_000)
    : Infinity;

  if (stats.totalSpent > 1500 || stats.orderCount >= 10) return "vip";
  if (stats.orderCount === 0) return "new";
  if (daysSilent > 90) return "dormant";
  if (daysSilent >= 45) return "at_risk";
  if (stats.orderCount === 1) return "new";
  if (stats.orderCount <= 5) return "repeat";
  return "repeat";
}

export async function statsFor(customerId: number): Promise<Stats> {
  const rows = await db
    .select()
    .from(order)
    .where(eq(order.customerId, customerId));

  const counted = rows.filter((o) =>
    (REVENUE_STATUSES as readonly string[]).includes(o.status),
  );
  const totalSpent = round2(counted.reduce((s, o) => s + o.total, 0));
  const lastOrderAt = counted.reduce<Date | null>(
    (latest, o) => (!latest || o.placedAt > latest ? o.placedAt : latest),
    null,
  );

  return {
    orderCount: counted.length,
    totalSpent,
    lastOrderAt,
    voucherOrders: counted.filter((o) => o.voucherId).length,
    aov: counted.length ? round2(totalSpent / counted.length) : 0,
  };
}

/** Recomputes the denormalised CRM fields for one customer. */
export async function recomputeCustomer(customerId: number) {
  const stats = await statsFor(customerId);
  const [{ avg }] = await db
    .select({ avg: sql<number>`coalesce(avg(${order.total}), 0)` })
    .from(order)
    .where(inArray(order.status, [...REVENUE_STATUSES]));

  const segment = segmentFor(stats);

  await db
    .update(customer)
    .set({
      orderCount: stats.orderCount,
      totalSpent: stats.totalSpent,
      lastOrderAt: stats.lastOrderAt,
      segment,
      highAov: stats.aov > (avg ?? 0) * 1.5 && stats.orderCount >= 2,
      promoHunter:
        stats.orderCount >= 3 && stats.voucherOrders / stats.orderCount > 0.5,
    })
    .where(eq(customer.id, customerId));

  return { ...stats, segment };
}

/** Full CRM sweep — used by the seed script and the admin "recalculate" action. */
export async function recomputeAllCustomers() {
  const all = await db.select({ id: customer.id }).from(customer);
  for (const c of all) await recomputeCustomer(c.id);
  return all.length;
}

export function daysSilent(c: Customer) {
  if (!c.lastOrderAt) return null;
  return Math.floor((Date.now() - c.lastOrderAt.getTime()) / 86_400_000);
}

/** Extra behavioural tags shown alongside the primary segment. */
export function behaviourTags(c: Customer) {
  const tags: string[] = [];
  if (c.highAov) tags.push("High AOV");
  if (c.promoHunter) tags.push("Promo hunter");
  if (c.birthday) {
    const [, m, d] = c.birthday.split("-").map(Number);
    const now = new Date();
    const bday = new Date(now.getFullYear(), (m || 1) - 1, d || 1);
    const delta = Math.round((bday.getTime() - now.getTime()) / 86_400_000);
    if (delta >= 0 && delta <= 30) tags.push(`Birthday in ${delta}d`);
  }
  return tags;
}
