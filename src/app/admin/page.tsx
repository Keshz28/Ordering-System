import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ChefHat,
  DollarSign,
  Receipt,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import {
  campaignPerformance,
  getKpis,
  lowStockItems,
  monthlyLtv,
  newVsReturning,
  ordersByType,
  paymentMix,
  promotionPerformance,
  revenueByDay,
  salesByHour,
  segmentBreakdown,
  topItems,
  topItemsByRevenue,
} from "@/lib/analytics";
import { SEGMENT_LABELS } from "@/lib/segments";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/ui/data";
import {
  ChartCard,
  DonutChart,
  HorizontalBars,
  HourlyBars,
  LtvLine,
  NewVsReturning,
  RevenueTrend,
} from "@/components/admin/charts";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [
    kpis,
    trend,
    hourly,
    byType,
    payments,
    itemsByUnits,
    itemsByRevenue,
    promos,
    cohorts,
    segments,
    ltv,
    campaigns,
    lowStock,
  ] = await Promise.all([
    getKpis(),
    revenueByDay(30),
    salesByHour(),
    ordersByType(),
    paymentMix(),
    topItems(10),
    topItemsByRevenue(10),
    promotionPerformance(),
    newVsReturning(30),
    segmentBreakdown(),
    monthlyLtv(),
    campaignPerformance(),
    lowStockItems(),
  ]);

  const campaignRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Everything happening at Bella Cucina right now."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/reports">Reports</Link>
            </Button>
            <Button asChild>
              <Link href="/kds">
                <ChefHat className="size-4" /> Kitchen
              </Link>
            </Button>
          </>
        }
      />

      {/* -------------------------------- KPIs ------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Today's revenue"
          value={money(kpis.todayRevenue)}
          sub={`${kpis.todayOrders} orders today`}
          icon={DollarSign}
          tone="brand"
        />
        <StatCard
          label="Orders (30 days)"
          value={kpis.orders30}
          sub={`${money(kpis.revenue30)} in revenue`}
          icon={Receipt}
        />
        <StatCard
          label="Average order"
          value={money(kpis.averageOrderValue)}
          sub="Last 30 days"
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="In the kitchen"
          value={kpis.pendingKitchen}
          sub="New, queued or cooking"
          icon={ChefHat}
          tone="warning"
        />
        <StatCard
          label="New customers"
          value={kpis.newCustomersThisMonth}
          sub="This month"
          icon={UserPlus}
        />
      </div>

      {lowStock.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-amber-700" />
          <p className="flex-1 text-sm text-amber-900">
            <strong>{lowStock.length} items low on stock:</strong>{" "}
            {lowStock.map((i) => `${i.name} (${i.stock})`).join(", ")}
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/menu">Manage stock</Link>
          </Button>
        </div>
      )}

      {/* ------------------------------- charts ------------------------------ */}
      <ChartCard
        title="Revenue, last 30 days"
        description={`${money(kpis.revenue30)} across ${kpis.orders30} orders`}
      >
        <RevenueTrend data={trend} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Busiest hours"
          description="Orders by hour of day, all time"
          className="lg:col-span-2"
        >
          <HourlyBars data={hourly} />
        </ChartCard>

        <ChartCard title="Orders by channel" description="Where orders come from">
          <DonutChart data={byType} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top 10 by units sold" description="Volume leaders">
          <HorizontalBars data={itemsByUnits} dataKey="units" />
        </ChartCard>

        <ChartCard title="Top 10 by revenue" description="Where the money is">
          <HorizontalBars
            data={itemsByRevenue}
            dataKey="revenue"
            color="#C9A227"
            format="money"
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Payment mix" description="How guests pay">
          <DonutChart data={payments} />
        </ChartCard>

        <ChartCard
          title="New vs returning"
          description="Orders in the last 30 days"
          className="lg:col-span-2"
        >
          <NewVsReturning data={cohorts} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Revenue per customer by month"
          description="A proxy for lifetime value as the base grows"
        >
          <LtvLine data={ltv} />
        </ChartCard>

        <ChartCard
          title="Promotion redemptions"
          description="Discount given away vs revenue on those orders"
          action={
            <Button size="sm" variant="ghost" asChild>
              <Link href="/admin/vouchers">Manage</Link>
            </Button>
          }
        >
          {promos.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">
              No vouchers redeemed yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {promos.map((p) => (
                <li
                  key={p.code}
                  className="flex items-center gap-3 rounded-xl border border-cream-300 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-ink-900">
                      {p.code}
                    </p>
                    <p className="truncate text-xs text-ink-500">{p.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink-900">
                      {p.redemptions} uses
                    </p>
                    <p className="text-xs text-ink-500">
                      −{money(p.discount)} → {money(p.revenue)}
                    </p>
                  </div>
                  {p.roi !== null && (
                    <Badge variant={p.roi > 3 ? "success" : "warning"}>
                      {p.roi.toFixed(1)}× ROI
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* ------------------------- segments & campaigns ---------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Customer segments"
          description="Recomputed automatically from order behaviour"
          action={
            <Button size="sm" variant="ghost" asChild>
              <Link href="/admin/customers">Open CRM</Link>
            </Button>
          }
        >
          <ul className="space-y-2">
            {segments.map((s) => (
              <li
                key={s.segment}
                className="flex items-center justify-between rounded-xl border border-cream-300 px-3 py-2.5"
              >
                <span className="text-sm text-ink-900">
                  {SEGMENT_LABELS[s.segment]}
                </span>
                <span className="text-sm text-ink-500">
                  <strong className="text-ink-900">{s.customers}</strong>{" "}
                  customers · {money(s.value)} lifetime
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          title="Campaign revenue"
          description={`${money(campaignRevenue)} attributed to campaigns`}
          action={
            <Button size="sm" variant="ghost" asChild>
              <Link href="/admin/campaigns">Campaigns</Link>
            </Button>
          }
        >
          {campaigns.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">
              No campaigns sent yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {campaigns.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-cream-300 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {c.name}
                    </p>
                    {c.roi !== null && (
                      <Badge variant={c.roi >= 2 ? "success" : "warning"}>
                        {c.roi.toFixed(1)}× ROI
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {c.recipients} sent · {c.opens} opened · {c.redeemed}{" "}
                    redeemed · {money(c.revenue)} revenue
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
