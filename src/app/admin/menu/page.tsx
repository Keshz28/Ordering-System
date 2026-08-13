import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getMenu, unitsSoldThisWeek } from "@/lib/menu";
import { PageHeader } from "@/components/ui/data";
import { MenuManager } from "@/components/admin/menu-manager";

export const metadata: Metadata = { title: "Menu & stock" };
export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  await requireStaff("admin");

  const [categories, sold] = await Promise.all([
    getMenu({ storefront: false }),
    unitsSoldThisWeek(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Menu & stock"
        description="Prices, availability, modifier rules and inventory — changes hit the storefront immediately."
      />
      <MenuManager
        categories={categories}
        soldThisWeek={Object.fromEntries(sold)}
      />
    </div>
  );
}
