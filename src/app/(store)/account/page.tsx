import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowRight, Gift, Receipt, Sparkles, TrendingUp } from "lucide-react";
import { db } from "@/db";
import { loyaltyTier, order, review } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { balanceFor, expiringSoon, offersFor, pendingFor } from "@/lib/loyalty";
import { nextTierFor, tierFor } from "@/lib/pricing";
import { STATUS_LABELS } from "@/lib/orders";
import { SEGMENT_LABELS } from "@/lib/segments";
import { formatDate, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { EmptyState, StatCard } from "@/components/ui/data";

export const dynamic = "force-dynamic";

export default async function AccountOverviewPage() {
  const customer = await requireCustomer();

  const [tiers, orders, offers, balance, pending, expiring, reviews] =
    await Promise.all([
      db.select().from(loyaltyTier).orderBy(loyaltyTier.minPoints),
      db
        .select()
        .from(order)
        .where(eq(order.customerId, customer.id))
        .orderBy(desc(order.placedAt))
        .limit(4),
      offersFor(customer.id),
      balanceFor(customer.id),
      pendingFor(customer.id),
      expiringSoon(customer.id),
      db.select().from(review).where(eq(review.customerId, customer.id)),
    ]);

  const tier = tierFor(tiers, customer.tierPoints);
  const next = nextTierFor(tiers, customer.tierPoints);
  const liveOffers = offers.filter((o) => !o.expired && !o.used);
  const progress = next
    ? Math.min(100, (customer.tierPoints / next.minPoints) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Points balance"
          value={balance.toLocaleString()}
          sub={pending > 0 ? `${pending.toLocaleString()} pending` : "Ready to spend"}
          icon={Sparkles}
          tone="brand"
        />
        <StatCard
          label="Lifetime spend"
          value={money(customer.totalSpent)}
          sub={`${customer.orderCount} orders`}
          icon={TrendingUp}
        />
        <StatCard
          label="Active offers"
          value={liveOffers.length}
          sub={liveOffers.length ? "Waiting in My offers" : "None right now"}
          icon={Gift}
          tone="success"
        />
        <StatCard
          label="Your status"
          value={SEGMENT_LABELS[customer.segment]}
          sub={tier ? `${tier.name} tier` : undefined}
          icon={Receipt}
        />
      </div>

      {/* ------------------------------ tier card ---------------------------- */}
      <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge
              style={{
                backgroundColor: `${tier?.color}18`,
                borderColor: `${tier?.color}55`,
                color: tier?.color,
              }}
            >
              {tier?.name ?? "Bronze"} member
            </Badge>
            <h2 className="mt-2 font-display text-2xl text-ink-900">
              {next
                ? `${(next.minPoints - customer.tierPoints).toLocaleString()} points to ${next.name}`
                : "You're at the top tier"}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Earning {tier?.earnRate ?? 10} points per $1
              {tier && tier.discountRate > 0
                ? ` · ${Math.round(tier.discountRate * 100)}% off every order`
                : ""}
              {tier?.freeDelivery ? " · free delivery" : ""}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/account/rewards">
              Spend points <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-5">
          <Progress
            value={progress}
            indicatorClassName="bg-gradient-to-r from-brand-600 to-gold-500"
          />
          <div className="mt-1.5 flex justify-between text-xs text-ink-500">
            <span>{customer.tierPoints.toLocaleString()} tier points</span>
            <span>
              {next ? `${next.minPoints.toLocaleString()} for ${next.name}` : "Gold"}
            </span>
          </div>
        </div>

        {expiring.length > 0 && (
          <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
            <strong>
              {expiring
                .reduce((s, e) => s + e.points, 0)
                .toLocaleString()}{" "}
              points
            </strong>{" "}
            expire on {formatDate(expiring[0].expiresAt)} — worth redeeming soon.
          </p>
        )}
      </section>

      {/* ---------------------------- recent orders -------------------------- */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl text-ink-900">Recent orders</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/account/orders">
              See all <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No orders yet"
            description="Your order history and one-tap reorder will appear here."
            action={
              <Button asChild>
                <Link href="/menu">Browse the menu</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/order/${o.id}`}
                className="flex items-center gap-3 rounded-card border border-cream-400 bg-white p-4 transition hover:border-brand-200 hover:shadow-[var(--shadow-card)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink-900">{o.number}</p>
                    <Badge
                      variant={
                        o.status === "completed"
                          ? "success"
                          : o.status === "canceled" || o.status === "refunded"
                            ? "danger"
                            : "info"
                      }
                    >
                      {STATUS_LABELS[o.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {formatDate(o.placedAt)} ·{" "}
                    {o.type.replace("_", "-")} · {money(o.total)}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-ink-500" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------- profile ----------------------------- */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-cream-400 bg-white p-5">
          <h3 className="text-sm font-semibold text-ink-900">Your preferences</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Phone</dt>
              <dd className="text-ink-900">{customer.phone ?? "Not set"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Birthday</dt>
              <dd className="text-ink-900">
                {customer.birthday
                  ? formatDate(new Date(customer.birthday))
                  : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Allergies</dt>
              <dd className="text-right text-ink-900">
                {(customer.allergies ?? []).length
                  ? (customer.allergies ?? []).join(", ")
                  : "None recorded"}
              </dd>
            </div>
            {customer.preferences && (
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-ink-500">Notes</dt>
                <dd className="text-right text-ink-900">{customer.preferences}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-card border border-cream-400 bg-white p-5">
          <h3 className="text-sm font-semibold text-ink-900">
            Reviews you&apos;ve left
          </h3>
          {reviews.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">
              No reviews yet. You earn 20 points for each one you leave.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {reviews.slice(0, 3).map((r) => (
                <li key={r.id} className="text-sm">
                  <p className="text-gold-500">{"★".repeat(r.rating)}</p>
                  <p className="text-ink-700">“{r.comment}”</p>
                  {r.reply && (
                    <p className="mt-1 rounded-lg bg-cream-100 px-2.5 py-1.5 text-xs text-ink-500">
                      <strong>Bella Cucina:</strong> {r.reply}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
