import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { menuItem, voucher } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { promotionPerformance } from "@/lib/analytics";
import { PageHeader } from "@/components/ui/data";
import { VoucherManager } from "@/components/admin/voucher-manager";

export const metadata: Metadata = { title: "Vouchers" };
export const dynamic = "force-dynamic";

export default async function AdminVouchersPage() {
  await requireStaff("admin");

  const [vouchers, items, performance] = await Promise.all([
    db.select().from(voucher).orderBy(desc(voucher.createdAt)),
    db.select().from(menuItem).where(eq(menuItem.isAvailable, true)),
    promotionPerformance(),
  ]);

  const stats = new Map(performance.map((p) => [p.code, p]));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vouchers"
        description="Every rule here is enforced at checkout — min spend, date window, order type, usage caps and stacking."
      />

      <VoucherManager
        vouchers={vouchers.map((v) => ({
          ...v,
          performance: stats.get(v.code) ?? null,
          // Server component — evaluated once per request, not during a client render.
          // eslint-disable-next-line react-hooks/purity
          expired: Boolean(v.validTo && v.validTo.getTime() <= Date.now()),
        }))}
        items={items.map((i) => ({ id: i.id, name: i.name, price: i.price }))}
      />
    </div>
  );
}
