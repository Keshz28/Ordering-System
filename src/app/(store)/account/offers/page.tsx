import Link from "next/link";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { Clock, Gift, Percent, Tag, Truck } from "lucide-react";
import { db } from "@/db";
import { loyaltyTier, voucher } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { offersFor } from "@/lib/loyalty";
import { tierFor } from "@/lib/pricing";
import { formatDate, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/data";
import { CopyCode } from "@/components/store/copy-code";

export const dynamic = "force-dynamic";

const TYPE_ICONS = {
  percent_off: Percent,
  fixed_off: Tag,
  free_item: Gift,
  free_delivery: Truck,
} as const;

export default async function MyOffersPage() {
  const customer = await requireCustomer();

  const [offers, tiers, publicVouchers] = await Promise.all([
    offersFor(customer.id),
    db.select().from(loyaltyTier).orderBy(loyaltyTier.minPoints),
    db
      .select()
      .from(voucher)
      .where(
        and(
          eq(voucher.active, true),
          eq(voucher.targeted, false),
          or(isNull(voucher.validTo), gt(voucher.validTo, new Date())),
        ),
      ),
  ]);

  const tier = tierFor(tiers, customer.tierPoints);
  const live = offers.filter((o) => !o.expired && !o.used);
  const spent = offers.filter((o) => o.expired || o.used);

  return (
    <div className="space-y-6">
      {/* --------------------------- tier discount --------------------------- */}
      {tier && tier.discountRate > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-card border p-5"
          style={{
            backgroundColor: `${tier.color}12`,
            borderColor: `${tier.color}44`,
          }}
        >
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-white"
            style={{ backgroundColor: tier.color }}
          >
            <Percent className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-ink-900">
              {tier.name}: {Math.round(tier.discountRate * 100)}% off active
            </p>
            <p className="text-sm text-ink-500">
              Applied automatically at checkout on every order
              {tier.freeDelivery ? ", plus free delivery" : ""}. Stacks with one
              voucher.
            </p>
          </div>
          <Badge variant="success">Always on</Badge>
        </div>
      )}

      {/* ------------------------- personal offers --------------------------- */}
      <section>
        <h2 className="mb-3 font-display text-xl text-ink-900">
          Offers on your account
        </h2>

        {live.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="No personal offers right now"
            description="Redeem points for vouchers, or keep an eye on your inbox — the kitchen sends offers to regulars."
            action={
              <Button asChild>
                <Link href="/account/rewards">Spend my points</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {live.map(({ voucher: v, issued, daysLeft }) => {
              const Icon = TYPE_ICONS[v.type];
              const urgent = daysLeft !== null && daysLeft <= 7;
              return (
                <div
                  key={issued.id}
                  className="relative overflow-hidden rounded-card border border-brand-200 bg-white p-5 shadow-[var(--shadow-card)]"
                >
                  <span className="absolute top-0 right-0 size-24 translate-x-8 -translate-y-8 rounded-full bg-brand-50" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid size-10 place-items-center rounded-xl bg-brand-700 text-white">
                        <Icon className="size-5" />
                      </span>
                      <Badge
                        variant={
                          issued.source === "loyalty"
                            ? "gold"
                            : issued.source === "campaign"
                              ? "info"
                              : "default"
                        }
                        className="capitalize"
                      >
                        {issued.source === "manual"
                          ? "From the owner"
                          : issued.source}
                      </Badge>
                    </div>

                    <p className="mt-3 font-display text-lg leading-tight text-ink-900">
                      {v.title}
                    </p>
                    {v.description && (
                      <p className="mt-1 text-xs text-ink-500">{v.description}</p>
                    )}

                    <CopyCode code={v.code} />

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {v.minSpend > 0 && (
                        <Badge variant="neutral">
                          Min spend {money(v.minSpend)}
                        </Badge>
                      )}
                      <Badge variant={urgent ? "danger" : "neutral"}>
                        <Clock className="size-3" />
                        {daysLeft === null
                          ? "No expiry"
                          : daysLeft === 0
                            ? "Expires today"
                            : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                      </Badge>
                    </div>

                    <Button size="sm" className="mt-4 w-full" asChild>
                      <Link href={`/menu`}>Use this offer</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* --------------------------- public offers --------------------------- */}
      {publicVouchers.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl text-ink-900">
            Everyone&apos;s offers
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {publicVouchers.map((v) => (
              <div
                key={v.id}
                className="rounded-card border border-dashed border-cream-500 bg-cream-100 p-4"
              >
                <p className="text-sm font-semibold text-ink-900">{v.title}</p>
                <p className="mt-0.5 text-xs text-ink-500">{v.description}</p>
                <CopyCode code={v.code} compact />
                {v.minSpend > 0 && (
                  <p className="mt-2 text-xs text-ink-500">
                    Minimum spend {money(v.minSpend)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------ history ------------------------------ */}
      {spent.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl text-ink-900">
            Used & expired
          </h2>
          <ul className="divide-y divide-cream-300 overflow-hidden rounded-card border border-cream-400 bg-white">
            {spent.map(({ voucher: v, issued, expiry, used }) => (
              <li
                key={issued.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm text-ink-700">{v.title}</p>
                  <p className="font-mono text-xs text-ink-500">{v.code}</p>
                </div>
                <Badge variant="neutral">
                  {used
                    ? `Used ${formatDate(issued.redeemedAt)}`
                    : `Expired ${formatDate(expiry)}`}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
