import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { promotion, settings } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { DEFAULT_SETTINGS } from "@/lib/pricing";
import { PageHeader } from "@/components/ui/data";
import { PromotionList } from "@/components/admin/promotion-list";

export const metadata: Metadata = { title: "Promotions" };
export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  await requireStaff("admin");

  const [promos, settingsRows] = await Promise.all([
    db.select().from(promotion).orderBy(asc(promotion.sortOrder)),
    db.select().from(settings).limit(1),
  ]);

  const config = settingsRows[0] ?? DEFAULT_SETTINGS;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Promotions"
        description="Automatic offers that need no code. Only the single best automatic promotion applies per order; tier discounts always stack on top."
      />

      <PromotionList
        promotions={promos}
        referral={{
          enabled: config.referralEnabled,
          value: config.referralValue,
        }}
      />
    </div>
  );
}
