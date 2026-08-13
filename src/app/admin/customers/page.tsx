import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { Download, Users } from "lucide-react";
import { db } from "@/db";
import { customer, loyaltyTier } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { tierFor } from "@/lib/pricing";
import {
  SEGMENT_DESCRIPTIONS,
  SEGMENT_LABELS,
  SEGMENT_STYLES,
  behaviourTags,
  daysSilent,
} from "@/lib/segments";
import { formatDate, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/data";
import { CustomerFilters } from "@/components/admin/customer-filters";
import { RecomputeButton } from "@/components/admin/recompute-button";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; segment?: string; sort?: string }>;
}) {
  await requireStaff("admin");
  const { q, segment, sort } = await searchParams;

  const [all, tiers] = await Promise.all([
    db.select().from(customer).orderBy(desc(customer.totalSpent)),
    db.select().from(loyaltyTier).orderBy(loyaltyTier.minPoints),
  ]);

  let rows = all;
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.email.toLowerCase().includes(needle) ||
        (c.phone ?? "").includes(needle),
    );
  }
  if (segment && segment !== "all") {
    rows = rows.filter((c) => c.segment === segment);
  }
  if (sort === "recent") {
    rows = [...rows].sort(
      (a, b) => (b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0),
    );
  } else if (sort === "orders") {
    rows = [...rows].sort((a, b) => b.orderCount - a.orderCount);
  } else if (sort === "points") {
    rows = [...rows].sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);
  }

  const counts = {
    all: all.length,
    new: all.filter((c) => c.segment === "new").length,
    repeat: all.filter((c) => c.segment === "repeat").length,
    vip: all.filter((c) => c.segment === "vip").length,
    at_risk: all.filter((c) => c.segment === "at_risk").length,
    dormant: all.filter((c) => c.segment === "dormant").length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description={`${all.length} guests · ${money(
          all.reduce((s, c) => s + c.totalSpent, 0),
        )} lifetime value`}
        actions={
          <>
            <RecomputeButton />
            <Button variant="outline" asChild>
              <a href="/api/admin/export?type=customers" download>
                <Download className="size-4" /> Export CSV
              </a>
            </Button>
          </>
        }
      />

      <CustomerFilters counts={counts} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers match"
          description="Try clearing the search or picking a different segment."
        />
      ) : (
        <DataTable>
          <Thead>
            <tr>
              <Th>Customer</Th>
              <Th>Segment</Th>
              <Th>Tier</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Lifetime value</Th>
              <Th className="text-right">Avg order</Th>
              <Th className="text-right">Points</Th>
              <Th>Last order</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.map((c) => {
              const tier = tierFor(tiers, c.tierPoints);
              const silent = daysSilent(c);
              const tags = behaviourTags(c);
              return (
                <Tr key={c.id}>
                  <Td>
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {c.name}
                    </Link>
                    <span className="block text-xs text-ink-500">{c.email}</span>
                    {tags.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {tags.map((t) => (
                          <Badge key={t} variant="outline">
                            {t}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${SEGMENT_STYLES[c.segment]}`}
                      title={SEGMENT_DESCRIPTIONS[c.segment]}
                    >
                      {SEGMENT_LABELS[c.segment]}
                    </span>
                  </Td>
                  <Td>
                    {tier && (
                      <span
                        className="text-xs font-medium"
                        style={{ color: tier.color }}
                      >
                        {tier.name}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{c.orderCount}</Td>
                  <Td className="text-right font-semibold tabular-nums text-ink-900">
                    {money(c.totalSpent)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {money(c.orderCount ? c.totalSpent / c.orderCount : 0)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {c.loyaltyPoints.toLocaleString()}
                  </Td>
                  <Td className="text-xs whitespace-nowrap">
                    {c.lastOrderAt ? (
                      <>
                        {formatDate(c.lastOrderAt)}
                        {silent !== null && silent > 30 && (
                          <span className="block text-amber-700">
                            {silent} days ago
                          </span>
                        )}
                      </>
                    ) : (
                      "Never"
                    )}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </DataTable>
      )}
    </div>
  );
}
