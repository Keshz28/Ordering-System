import type { Metadata } from "next";
import { db } from "@/db";
import { deliveryZone, loyaltyTier, settings } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { DEFAULT_SETTINGS } from "@/lib/pricing";
import { stripeEnabled } from "@/lib/payments";
import { emailEnabled } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/data";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  // Owner-only; the layout already blocked non-admin roles.
  await requireStaff("settings", ["owner"]);

  const [rows, zones, tiers] = await Promise.all([
    db.select().from(settings).limit(1),
    db.select().from(deliveryZone).orderBy(deliveryZone.fee),
    db.select().from(loyaltyTier).orderBy(loyaltyTier.minPoints),
  ]);

  const config = rows[0] ?? DEFAULT_SETTINGS;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Business configuration. Changing tax or service charge affects every new order immediately."
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant={stripeEnabled() ? "success" : "neutral"}>
          Payments: {stripeEnabled() ? "Stripe test mode" : "Simulated"}
        </Badge>
        <Badge variant={emailEnabled() ? "success" : "neutral"}>
          Email: {emailEnabled() ? "Resend live" : "In-app inbox only"}
        </Badge>
        <Badge variant="neutral">
          Database:{" "}
          {process.env.TURSO_DATABASE_URL &&
          !process.env.TURSO_DATABASE_URL.startsWith("file:")
            ? "Turso (remote)"
            : "Local SQLite file"}
        </Badge>
      </div>

      <SettingsForm settings={config} zones={zones} tiers={tiers} />
    </div>
  );
}
