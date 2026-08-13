import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Megaphone } from "lucide-react";
import { db } from "@/db";
import { campaign } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { RECIPES } from "@/lib/campaigns";
import { emailEnabled } from "@/lib/notify";
import { segmentBreakdown } from "@/lib/analytics";
import { formatDate, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import { CampaignLauncher } from "@/components/admin/campaign-launcher";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  await requireStaff("admin");

  const [sent, segments] = await Promise.all([
    db.select().from(campaign).orderBy(desc(campaign.sentAt)),
    segmentBreakdown(),
  ]);

  const totalRevenue = sent.reduce((s, c) => s + c.revenue, 0);
  const totalCost = sent.reduce((s, c) => s + c.discountCost, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campaigns"
        description={`${sent.length} campaigns · ${money(totalRevenue)} attributed revenue against ${money(totalCost)} in discounts`}
      />

      <CampaignLauncher
        recipes={RECIPES}
        segments={segments}
        emailLive={emailEnabled()}
      />

      <section>
        <h2 className="mb-3 font-display text-xl text-ink-900">
          Campaign history
        </h2>

        {sent.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns sent yet"
            description="Pick a recipe above — it pre-fills the audience, the message and the offer."
          />
        ) : (
          <DataTable>
            <Thead>
              <tr>
                <Th>Campaign</Th>
                <Th>Audience</Th>
                <Th>Sent</Th>
                <Th className="text-right">Recipients</Th>
                <Th className="text-right">Opened</Th>
                <Th className="text-right">Redeemed</Th>
                <Th className="text-right">Revenue</Th>
                <Th className="text-right">Discount cost</Th>
                <Th className="text-right">ROI</Th>
              </tr>
            </Thead>
            <Tbody>
              {sent.map((c) => {
                const roi = c.discountCost > 0 ? c.revenue / c.discountCost : null;
                return (
                  <Tr key={c.id}>
                    <Td>
                      <span className="font-medium text-ink-900">{c.name}</span>
                      {c.recipe && (
                        <span className="block text-xs text-ink-500">
                          recipe: {c.recipe.replace(/_/g, " ")}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge variant="neutral" className="capitalize">
                        {c.targetSegment.replace("_", " ")}
                      </Badge>
                    </Td>
                    <Td className="text-xs whitespace-nowrap">
                      {formatDate(c.sentAt)}
                    </Td>
                    <Td className="text-right tabular-nums">{c.recipients}</Td>
                    <Td className="text-right tabular-nums">
                      {c.opens}
                      {c.recipients > 0 && (
                        <span className="ml-1 text-xs text-ink-500">
                          {Math.round((c.opens / c.recipients) * 100)}%
                        </span>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">{c.redeemed}</Td>
                    <Td className="text-right font-semibold tabular-nums text-ink-900">
                      {money(c.revenue)}
                    </Td>
                    <Td className="text-right tabular-nums text-ink-500">
                      {money(c.discountCost)}
                    </Td>
                    <Td className="text-right">
                      {roi === null ? (
                        <span className="text-xs text-ink-500">—</span>
                      ) : (
                        <Badge variant={roi >= 2 ? "success" : "warning"}>
                          {roi.toFixed(1)}×
                        </Badge>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </DataTable>
        )}
      </section>
    </div>
  );
}
