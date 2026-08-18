import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import {
  campaignPerformance,
  monthlyLtv,
  promotionPerformance,
  revenueByDay,
  salesByHour,
  topItemsByRevenue,
} from "@/lib/analytics";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  PageHeader,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/data";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const EXPORTS = [
  { type: "orders", label: "Orders", note: "Every order with fees, discounts and payment status" },
  { type: "customers", label: "Customers", note: "CRM export with segments, LTV and loyalty" },
  { type: "sales_by_day", label: "Sales by day", note: "Last 90 days, revenue and order count" },
  { type: "sales_by_hour", label: "Sales by hour", note: "Trading pattern across the day" },
  { type: "products", label: "Product performance", note: "Units, revenue and average price per dish" },
];

export default async function AdminReportsPage() {
  await requireStaff("admin");

  const [daily, hourly, products, promos, campaigns, ltv] = await Promise.all([
    revenueByDay(30),
    salesByHour(),
    topItemsByRevenue(30),
    promotionPerformance(),
    campaignPerformance(),
    monthlyLtv(),
  ]);

  const bestDay = [...daily].sort((a, b) => b.revenue - a.revenue)[0];
  const bestHour = [...hourly].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Everything here exports to CSV for your accountant or spreadsheet."
      />

      {/* ------------------------------ exports ----------------------------- */}
      <section>
        <h2 className="mb-3 font-display text-xl text-ink-900">Exports</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXPORTS.map((e) => (
            <div
              key={e.type}
              className="flex items-center gap-3 rounded-card border border-cream-400 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{e.label}</p>
                <p className="text-xs text-ink-500">{e.note}</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/admin/export?type=${e.type}`} download>
                  <Download className="size-3.5" /> CSV
                </a>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------- sales by day --------------------------- */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl text-ink-900">Sales by day</h2>
            <p className="text-sm text-ink-500">
              Best day: {bestDay?.label} at {money(bestDay?.revenue ?? 0)}
            </p>
          </div>
        </div>
        <DataTable>
          <Thead>
            <tr>
              <Th>Date</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Revenue</Th>
              <Th className="text-right">Average order</Th>
            </tr>
          </Thead>
          <Tbody>
            {[...daily].reverse().map((d) => (
              <Tr key={d.day}>
                <Td>{d.label}</Td>
                <Td className="text-right tabular-nums">{d.orders}</Td>
                <Td className="text-right font-semibold tabular-nums text-ink-900">
                  {money(d.revenue)}
                </Td>
                <Td className="text-right tabular-nums">
                  {money(d.orders ? d.revenue / d.orders : 0)}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </DataTable>
      </section>

      {/* --------------------------- sales by hour -------------------------- */}
      <section>
        <h2 className="font-display text-xl text-ink-900">Sales by hour</h2>
        <p className="mb-3 text-sm text-ink-500">
          Peak hour: {bestHour?.label} at {money(bestHour?.revenue ?? 0)}
        </p>
        <DataTable>
          <Thead>
            <tr>
              <Th>Hour</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Revenue</Th>
            </tr>
          </Thead>
          <Tbody>
            {hourly.map((h) => (
              <Tr key={h.hour}>
                <Td>{h.label}</Td>
                <Td className="text-right tabular-nums">{h.orders}</Td>
                <Td className="text-right font-semibold tabular-nums text-ink-900">
                  {money(h.revenue)}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </DataTable>
      </section>

      {/* ------------------------ product performance ----------------------- */}
      <section>
        <h2 className="mb-3 font-display text-xl text-ink-900">
          Per-product performance
        </h2>
        <DataTable>
          <Thead>
            <tr>
              <Th>Item</Th>
              <Th className="text-right">Units sold</Th>
              <Th className="text-right">Revenue</Th>
              <Th className="text-right">Average price</Th>
            </tr>
          </Thead>
          <Tbody>
            {products.map((p) => (
              <Tr key={p.name}>
                <Td className="font-medium text-ink-900">{p.name}</Td>
                <Td className="text-right tabular-nums">{p.units}</Td>
                <Td className="text-right font-semibold tabular-nums text-ink-900">
                  {money(p.revenue)}
                </Td>
                <Td className="text-right tabular-nums">
                  {money(p.revenue / Math.max(1, p.units))}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </DataTable>
      </section>

      {/* --------------------------- promotion ROI -------------------------- */}
      <section>
        <h2 className="font-display text-xl text-ink-900">Promotion ROI</h2>
        <p className="mb-3 text-sm text-ink-500">
          Revenue earned on orders using each code, against the discount given
          away.
        </p>
        <DataTable>
          <Thead>
            <tr>
              <Th>Code</Th>
              <Th>Offer</Th>
              <Th className="text-right">Redemptions</Th>
              <Th className="text-right">Discount given</Th>
              <Th className="text-right">Revenue</Th>
              <Th className="text-right">Net per RM1 discounted</Th>
            </tr>
          </Thead>
          <Tbody>
            {promos.map((p) => (
              <Tr key={p.code}>
                <Td className="font-mono font-semibold text-brand-800">
                  {p.code}
                </Td>
                <Td className="text-sm">{p.title}</Td>
                <Td className="text-right tabular-nums">{p.redemptions}</Td>
                <Td className="text-right tabular-nums text-ink-500">
                  −{money(p.discount)}
                </Td>
                <Td className="text-right font-semibold tabular-nums text-ink-900">
                  {money(p.revenue)}
                </Td>
                <Td className="text-right">
                  {p.roi === null ? (
                    "—"
                  ) : (
                    <Badge variant={p.roi > 3 ? "success" : "warning"}>
                      {p.roi.toFixed(1)}×
                    </Badge>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </DataTable>
      </section>

      {/* ----------------------------- campaigns ---------------------------- */}
      {campaigns.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl text-ink-900">
            Campaign-generated revenue
          </h2>
          <DataTable>
            <Thead>
              <tr>
                <Th>Campaign</Th>
                <Th>Segment</Th>
                <Th className="text-right">Sent</Th>
                <Th className="text-right">Redeemed</Th>
                <Th className="text-right">Revenue</Th>
                <Th className="text-right">Cost</Th>
                <Th className="text-right">ROI</Th>
              </tr>
            </Thead>
            <Tbody>
              {campaigns.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium text-ink-900">{c.name}</Td>
                  <Td className="text-sm capitalize">
                    {c.segment.replace("_", " ")}
                  </Td>
                  <Td className="text-right tabular-nums">{c.recipients}</Td>
                  <Td className="text-right tabular-nums">{c.redeemed}</Td>
                  <Td className="text-right font-semibold tabular-nums text-ink-900">
                    {money(c.revenue)}
                  </Td>
                  <Td className="text-right tabular-nums text-ink-500">
                    {money(c.discountCost)}
                  </Td>
                  <Td className="text-right">
                    {c.roi === null ? (
                      "—"
                    ) : (
                      <Badge variant={c.roi >= 2 ? "success" : "warning"}>
                        {c.roi.toFixed(1)}×
                      </Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </DataTable>
        </section>
      )}

      {/* ------------------------------- LTV -------------------------------- */}
      <section>
        <h2 className="mb-3 font-display text-xl text-ink-900">
          Monthly revenue per customer
        </h2>
        <DataTable>
          <Thead>
            <tr>
              <Th>Month</Th>
              <Th className="text-right">Distinct customers</Th>
              <Th className="text-right">Revenue</Th>
              <Th className="text-right">Revenue per customer</Th>
            </tr>
          </Thead>
          <Tbody>
            {ltv.map((m) => (
              <Tr key={m.month}>
                <Td>{m.label}</Td>
                <Td className="text-right tabular-nums">{m.customers}</Td>
                <Td className="text-right font-semibold tabular-nums text-ink-900">
                  {money(m.revenue)}
                </Td>
                <Td className="text-right tabular-nums">{money(m.ltv)}</Td>
              </Tr>
            ))}
          </Tbody>
        </DataTable>
      </section>
    </div>
  );
}
