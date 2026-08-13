import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Cake,
  Mail,
  Phone,
  Receipt,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { db } from "@/db";
import {
  campaign,
  campaignRecipient,
  customer,
  loyaltyTier,
  menuItem,
  notification,
  order,
  review,
} from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { offersFor, ledgerFor, balanceFor, pendingFor } from "@/lib/loyalty";
import { nextTierFor, tierFor } from "@/lib/pricing";
import { STATUS_LABELS } from "@/lib/orders";
import {
  SEGMENT_DESCRIPTIONS,
  SEGMENT_LABELS,
  SEGMENT_STYLES,
  behaviourTags,
  daysSilent,
} from "@/lib/segments";
import { formatDate, formatDateTime, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import { Progress } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/data";
import { IssueVoucherCard } from "@/components/admin/issue-voucher-card";

export const metadata: Metadata = { title: "Customer profile" };
export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("admin");
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) notFound();

  const [record] = await db
    .select()
    .from(customer)
    .where(eq(customer.id, customerId));
  if (!record) notFound();

  const [orders, tiers, offers, ledger, reviews, messages, campaignRows, items] =
    await Promise.all([
      db
        .select()
        .from(order)
        .where(eq(order.customerId, customerId))
        .orderBy(desc(order.placedAt)),
      db.select().from(loyaltyTier).orderBy(loyaltyTier.minPoints),
      offersFor(customerId),
      ledgerFor(customerId, 12),
      db.select().from(review).where(eq(review.customerId, customerId)),
      db
        .select()
        .from(notification)
        .where(eq(notification.customerId, customerId))
        .orderBy(desc(notification.sentAt))
        .limit(8),
      db
        .select({ recipient: campaignRecipient, campaign })
        .from(campaignRecipient)
        .innerJoin(campaign, eq(campaignRecipient.campaignId, campaign.id))
        .where(eq(campaignRecipient.customerId, customerId)),
      db.select().from(menuItem).where(eq(menuItem.isAvailable, true)),
    ]);

  const [balance, pending] = await Promise.all([
    balanceFor(customerId),
    pendingFor(customerId),
  ]);

  const tier = tierFor(tiers, record.tierPoints);
  const next = nextTierFor(tiers, record.tierPoints);
  const silent = daysSilent(record);
  const tags = behaviourTags(record);
  const liveOffers = offers.filter((o) => !o.expired && !o.used);
  const aov = record.orderCount ? record.totalSpent / record.orderCount : 0;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
      >
        <ArrowLeft className="size-4" /> Back to CRM
      </Link>

      {/* ------------------------------- header ------------------------------ */}
      <div className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl text-ink-900">
                {record.name}
              </h1>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${SEGMENT_STYLES[record.segment]}`}
                title={SEGMENT_DESCRIPTIONS[record.segment]}
              >
                {SEGMENT_LABELS[record.segment]}
              </span>
              {tier && (
                <Badge
                  style={{
                    backgroundColor: `${tier.color}18`,
                    borderColor: `${tier.color}55`,
                    color: tier.color,
                  }}
                >
                  {tier.name}
                </Badge>
              )}
              {tags.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-500">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" /> {record.email}
              </span>
              {record.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" /> {record.phone}
                </span>
              )}
              {record.birthday && (
                <span className="flex items-center gap-1.5">
                  <Cake className="size-3.5" />{" "}
                  {formatDate(new Date(record.birthday))}
                </span>
              )}
              <span>Joined {formatDate(record.createdAt)}</span>
            </div>

            {(record.allergies ?? []).length > 0 && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <TriangleAlert className="size-4 shrink-0" />
                Allergies: <strong>{(record.allergies ?? []).join(", ")}</strong>
              </p>
            )}
            {record.preferences && (
              <p className="mt-2 rounded-xl bg-cream-100 px-3 py-2 text-sm text-ink-700">
                {record.preferences}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------- stats ------------------------------ */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lifetime value"
          value={money(record.totalSpent)}
          sub={`${record.orderCount} orders`}
          icon={Receipt}
          tone="brand"
        />
        <StatCard
          label="Average order"
          value={money(aov)}
          sub={record.highAov ? "Well above average" : "Around average"}
        />
        <StatCard
          label="Points balance"
          value={balance.toLocaleString()}
          sub={pending > 0 ? `${pending.toLocaleString()} pending` : "All available"}
          icon={Sparkles}
          tone="success"
        />
        <StatCard
          label="Last order"
          value={record.lastOrderAt ? formatDate(record.lastOrderAt) : "Never"}
          sub={silent !== null ? `${silent} days ago` : "No orders yet"}
          tone={silent !== null && silent > 45 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          {/* ------------------------- order history ------------------------- */}
          <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-lg text-ink-900">Order history</h2>
            {orders.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">No orders yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-cream-300">
                {orders.slice(0, 12).map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center gap-3 py-2.5"
                  >
                    <Link
                      href={`/order/${o.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {o.number}
                    </Link>
                    <Badge
                      variant={
                        o.status === "completed"
                          ? "success"
                          : o.status === "refunded" || o.status === "canceled"
                            ? "danger"
                            : "info"
                      }
                    >
                      {STATUS_LABELS[o.status]}
                    </Badge>
                    <span className="text-xs text-ink-500 capitalize">
                      {o.type.replace("_", "-")}
                    </span>
                    {o.voucherCode && (
                      <Badge variant="warning">{o.voucherCode}</Badge>
                    )}
                    <span className="ml-auto text-xs text-ink-500">
                      {formatDate(o.placedAt)}
                    </span>
                    <span className="w-20 text-right font-semibold tabular-nums text-ink-900">
                      {money(o.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {orders.length > 12 && (
              <p className="mt-2 text-xs text-ink-500">
                Showing the 12 most recent of {orders.length}.
              </p>
            )}
          </section>

          {/* ------------------------ campaigns & inbox ---------------------- */}
          <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-lg text-ink-900">
              Campaign interactions
            </h2>
            {campaignRows.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">
                This customer hasn&apos;t been included in a campaign yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {campaignRows.map(({ recipient, campaign: c }) => (
                  <li
                    key={recipient.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-cream-300 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-ink-900">
                      {c.name}
                    </span>
                    <Badge variant="neutral">{c.targetSegment}</Badge>
                    {recipient.opened && <Badge variant="info">Opened</Badge>}
                    {recipient.clicked && <Badge variant="success">Clicked</Badge>}
                    {recipient.revenue > 0 && (
                      <Badge variant="gold">
                        {money(recipient.revenue)} attributed
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-ink-500">
                      {formatDate(c.sentAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-5 text-sm font-semibold text-ink-900">
              Recent messages
            </h3>
            <ul className="mt-2 space-y-1.5">
              {messages.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="text-ink-900">{m.title}</span>
                  <span className="ml-2 text-xs text-ink-500">
                    {formatDateTime(m.sentAt)} · {m.channel}
                    {m.readAt ? " · read" : " · unread"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ----------------------------- reviews --------------------------- */}
          {reviews.length > 0 && (
            <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
              <h2 className="font-display text-lg text-ink-900">Reviews</h2>
              <ul className="mt-3 space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="text-sm">
                    <p className="text-gold-500">{"★".repeat(r.rating)}</p>
                    <p className="text-ink-700">“{r.comment}”</p>
                    {r.reply && (
                      <p className="mt-1 rounded-lg bg-cream-100 px-3 py-2 text-xs text-ink-500">
                        <strong>Reply:</strong> {r.reply}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ------------------------------ sidebar ---------------------------- */}
        <div className="space-y-4">
          <IssueVoucherCard
            customerId={record.id}
            customerName={record.name}
            items={items.map((i) => ({ id: i.id, name: i.name }))}
          />

          {/* ------------------------------ loyalty -------------------------- */}
          <section className="rounded-card border border-cream-400 bg-white p-5">
            <h2 className="text-sm font-semibold text-ink-900">Loyalty</h2>
            <p className="mt-2 font-display text-2xl text-ink-900">
              {balance.toLocaleString()}{" "}
              <span className="text-sm font-normal text-ink-500">points</span>
            </p>
            {next && (
              <>
                <Progress
                  value={Math.min(100, (record.tierPoints / next.minPoints) * 100)}
                  className="mt-3"
                  indicatorClassName="bg-gradient-to-r from-brand-600 to-gold-500"
                />
                <p className="mt-1 text-xs text-ink-500">
                  {(next.minPoints - record.tierPoints).toLocaleString()} tier
                  points to {next.name}
                </p>
              </>
            )}

            <ul className="mt-3 space-y-1 border-t border-cream-300 pt-3 text-xs">
              {ledger.slice(0, 6).map((row) => (
                <li key={row.id} className="flex justify-between gap-2">
                  <span className="truncate text-ink-500 capitalize">
                    {row.reason}
                  </span>
                  <span
                    className={
                      row.points > 0
                        ? "font-medium text-emerald-700"
                        : "font-medium text-brand-700"
                    }
                  >
                    {row.points > 0 ? "+" : ""}
                    {row.points}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ------------------------------ offers --------------------------- */}
          <section className="rounded-card border border-cream-400 bg-white p-5">
            <h2 className="text-sm font-semibold text-ink-900">
              Vouchers held ({liveOffers.length} active)
            </h2>
            {offers.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">
                No personal vouchers yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {offers.slice(0, 6).map(({ voucher: v, issued, expired, used, daysLeft }) => (
                  <li
                    key={issued.id}
                    className="rounded-xl border border-cream-300 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-brand-800">
                        {v.code}
                      </span>
                      <Badge
                        variant={
                          used ? "neutral" : expired ? "danger" : "success"
                        }
                      >
                        {used ? "Used" : expired ? "Expired" : `${daysLeft}d left`}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-500">{v.title}</p>
                    <p className="text-[11px] text-ink-500 capitalize">
                      via {issued.source}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
