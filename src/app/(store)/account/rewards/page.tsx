import { eq } from "drizzle-orm";
import { Clock, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { db } from "@/db";
import { loyaltyRedemption, loyaltyTier, menuItem } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import {
  balanceFor,
  expiringSoon,
  ledgerFor,
  pendingFor,
  runPointsMaintenance,
} from "@/lib/loyalty";
import { nextTierFor, tierFor } from "@/lib/pricing";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/data";
import { RedeemCard } from "@/components/store/redeem-card";

export const dynamic = "force-dynamic";

const STATE_STYLES: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "danger" | "info" }> = {
  active: { label: "Available", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  redeemed: { label: "Spent", variant: "info" },
  expired: { label: "Expired", variant: "neutral" },
  clawed_back: { label: "Reversed", variant: "danger" },
};

export default async function RewardsPage() {
  const customer = await requireCustomer();

  // Lazily sweep expiries and fire the 90/30-day warnings on visit.
  await runPointsMaintenance(customer.id);

  const [tiers, catalogue, balance, pending, expiring, ledger, items] =
    await Promise.all([
      db.select().from(loyaltyTier).orderBy(loyaltyTier.minPoints),
      db
        .select()
        .from(loyaltyRedemption)
        .where(eq(loyaltyRedemption.active, true))
        .orderBy(loyaltyRedemption.pointsCost),
      balanceFor(customer.id),
      pendingFor(customer.id),
      expiringSoon(customer.id),
      ledgerFor(customer.id, 25),
      db.select().from(menuItem),
    ]);

  const tier = tierFor(tiers, customer.tierPoints);
  const next = nextTierFor(tiers, customer.tierPoints);
  const itemName = new Map(items.map((i) => [i.id, i.name]));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Available points"
          value={balance.toLocaleString()}
          sub="Ready to redeem"
          icon={Sparkles}
          tone="brand"
        />
        <StatCard
          label="Pending"
          value={pending.toLocaleString()}
          sub="Credited when your order completes"
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Tier points (12 mo)"
          value={customer.tierPoints.toLocaleString()}
          sub={
            next
              ? `${(next.minPoints - customer.tierPoints).toLocaleString()} to ${next.name}`
              : "Top tier reached"
          }
          icon={TrendingUp}
          tone="success"
        />
      </div>

      {/* ------------------------------- tiers ------------------------------- */}
      <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl text-ink-900">Your tier</h2>
        <p className="mt-1 text-sm text-ink-500">
          Tiers use a rolling 12-month earning window. Spending points never
          drops your tier.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {tiers.map((t) => {
            const isCurrent = t.id === tier?.id;
            const reached = customer.tierPoints >= t.minPoints;
            return (
              <div
                key={t.id}
                className="rounded-2xl border p-4 transition"
                style={{
                  borderColor: isCurrent ? t.color : undefined,
                  backgroundColor: isCurrent ? `${t.color}10` : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold" style={{ color: t.color }}>
                    {t.name}
                  </p>
                  {isCurrent ? (
                    <Badge variant="success">You&apos;re here</Badge>
                  ) : reached ? (
                    <Badge variant="neutral">Unlocked</Badge>
                  ) : (
                    <Badge variant="outline">
                      {t.minPoints.toLocaleString()} pts
                    </Badge>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-ink-500">
                  {(t.benefits ?? []).map((b) => (
                    <li key={b}>· {b}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {next && (
          <div className="mt-4">
            <Progress
              value={Math.min(100, (customer.tierPoints / next.minPoints) * 100)}
              indicatorClassName="bg-gradient-to-r from-brand-600 to-gold-500"
            />
          </div>
        )}
      </section>

      {/* ---------------------------- expiry notice -------------------------- */}
      {expiring.length > 0 && (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-5">
          <p className="flex items-center gap-2 font-medium text-amber-900">
            <Clock className="size-4" />
            {expiring.reduce((s, e) => s + e.points, 0).toLocaleString()} points
            expiring within 90 days
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900/80">
            {expiring.slice(0, 3).map((e) => (
              <li key={e.id}>
                {e.points.toLocaleString()} points on {formatDate(e.expiresAt)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ------------------------- redemption catalogue ---------------------- */}
      <section>
        <h2 className="mb-1 font-display text-xl text-ink-900">
          Redeem your points
        </h2>
        <p className="mb-3 text-sm text-ink-500">
          Each redemption becomes a personal voucher. One redeemed voucher per
          order, and it stacks with your tier discount.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalogue.map((r) => (
            <RedeemCard
              key={r.id}
              reward={{
                id: r.id,
                name: r.name,
                description: r.description,
                pointsCost: r.pointsCost,
                minSpend: r.minSpend,
                validDays: r.validDays,
                freeItemName: r.freeItemId
                  ? (itemName.get(r.freeItemId) ?? null)
                  : null,
              }}
              balance={balance}
            />
          ))}
        </div>
      </section>

      {/* ------------------------------- ledger ------------------------------ */}
      <section>
        <h2 className="mb-3 font-display text-xl text-ink-900">
          Points history
        </h2>
        <ul className="divide-y divide-cream-300 overflow-hidden rounded-card border border-cream-400 bg-white">
          {ledger.map((row) => {
            const style = STATE_STYLES[row.state] ?? STATE_STYLES.active;
            const positive = row.points > 0;
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span
                  className={
                    positive
                      ? "grid size-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"
                      : "grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"
                  }
                >
                  {positive ? (
                    <TrendingUp className="size-4" />
                  ) : (
                    <TrendingDown className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink-900 capitalize">
                    {row.reason}
                  </p>
                  <p className="text-xs text-ink-500">
                    {formatDate(row.createdAt)}
                    {row.expiresAt && row.state === "active"
                      ? ` · expires ${formatDate(row.expiresAt)}`
                      : ""}
                  </p>
                </div>
                <Badge variant={style.variant}>{style.label}</Badge>
                <span
                  className={
                    positive
                      ? "w-20 text-right font-semibold tabular-nums text-emerald-700"
                      : "w-20 text-right font-semibold tabular-nums text-brand-700"
                  }
                >
                  {positive ? "+" : ""}
                  {row.points.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
