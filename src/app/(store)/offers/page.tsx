import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { Gift, Percent, Sparkles, Tag, Truck } from "lucide-react";
import { db } from "@/db";
import { loyaltyRedemption, loyaltyTier, promotion, voucher } from "@/db/schema";
import { currentCustomer } from "@/lib/auth";
import { formatDate, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyCode } from "@/components/store/copy-code";

export const metadata: Metadata = { title: "Offers & rewards" };
export const dynamic = "force-dynamic";

const TYPE_ICONS = {
  percent_off: Percent,
  fixed_off: Tag,
  free_item: Gift,
  free_delivery: Truck,
} as const;

export default async function OffersPage() {
  const [vouchers, promos, tiers, catalogue, customer] = await Promise.all([
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
    db
      .select()
      .from(promotion)
      .where(eq(promotion.active, true))
      .orderBy(promotion.sortOrder),
    db.select().from(loyaltyTier).orderBy(loyaltyTier.minPoints),
    db
      .select()
      .from(loyaltyRedemption)
      .where(eq(loyaltyRedemption.active, true))
      .orderBy(loyaltyRedemption.pointsCost),
    currentCustomer(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl text-ink-900">Offers & rewards</h1>
      <p className="mt-1 text-sm text-ink-500">
        Everything currently running at Bella Cucina.
      </p>

      {customer ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-card border border-gold-400/50 bg-gold-500/10 p-4">
          <Sparkles className="size-5 text-gold-600" />
          <p className="flex-1 text-sm text-amber-900">
            You have{" "}
            <strong>{customer.loyaltyPoints.toLocaleString()} points</strong> to
            spend, plus any personal offers on your account.
          </p>
          <Button size="sm" asChild>
            <Link href="/account/offers">Open My offers</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-card border border-cream-400 bg-white p-4">
          <Sparkles className="size-5 text-brand-700" />
          <p className="flex-1 text-sm text-ink-700">
            Sign in with your email to collect points and receive personal
            offers.
          </p>
          <Button size="sm" asChild>
            <Link href="/login?next=/offers">Sign in</Link>
          </Button>
        </div>
      )}

      {/* ------------------------------ vouchers ---------------------------- */}
      <section className="mt-9">
        <h2 className="mb-3 font-display text-xl text-ink-900">
          Voucher codes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vouchers.map((v) => {
            const Icon = TYPE_ICONS[v.type];
            return (
              <div
                key={v.id}
                className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="size-5" />
                  </span>
                  {v.stackable && <Badge variant="info">Stackable</Badge>}
                </div>
                <p className="mt-3 font-display text-lg leading-tight text-ink-900">
                  {v.title}
                </p>
                <p className="mt-1 text-xs text-ink-500">{v.description}</p>
                <CopyCode code={v.code} />
                <ul className="mt-3 space-y-1 text-xs text-ink-500">
                  {v.minSpend > 0 && <li>· Minimum spend {money(v.minSpend)}</li>}
                  {v.perCustomerLimit && (
                    <li>
                      · {v.perCustomerLimit} use
                      {v.perCustomerLimit === 1 ? "" : "s"} per customer
                    </li>
                  )}
                  {(v.orderTypes ?? []).length < 3 && (
                    <li>
                      ·{" "}
                      {(v.orderTypes ?? [])
                        .map((t) => t.replace("_", "-"))
                        .join(", ")}{" "}
                      only
                    </li>
                  )}
                  {v.validTo && <li>· Ends {formatDate(v.validTo)}</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ----------------------------- promotions --------------------------- */}
      <section className="mt-9">
        <h2 className="mb-3 font-display text-xl text-ink-900">
          Running promotions
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {promos.map((p) => (
            <div
              key={p.id}
              className="flex gap-3 rounded-card border border-cream-400 bg-white p-4"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cream-200 text-brand-700">
                <Gift className="size-4" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink-900">{p.title}</p>
                  <Badge variant="neutral" className="capitalize">
                    {p.type.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-ink-500">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------- tiers ------------------------------ */}
      <section className="mt-9">
        <h2 className="mb-3 font-display text-xl text-ink-900">
          Bella Rewards tiers
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.id}
              className="rounded-card border bg-white p-5"
              style={{ borderColor: `${t.color}55` }}
            >
              <p className="font-display text-lg" style={{ color: t.color }}>
                {t.name}
              </p>
              <p className="text-xs text-ink-500">
                From {t.minPoints.toLocaleString()} points
              </p>
              <ul className="mt-3 space-y-1 text-sm text-ink-700">
                {(t.benefits ?? []).map((b) => (
                  <li key={b}>· {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------- redemptions --------------------------- */}
      <section className="mt-9">
        <h2 className="mb-3 font-display text-xl text-ink-900">
          What points buy
        </h2>
        <ul className="divide-y divide-cream-300 overflow-hidden rounded-card border border-cream-400 bg-white">
          {catalogue.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ink-900">{r.name}</p>
                <p className="text-xs text-ink-500">{r.description}</p>
              </div>
              <Badge variant="gold">{r.pointsCost.toLocaleString()} pts</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
