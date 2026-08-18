"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Cake,
  Clock,
  Gift,
  Image as ImageIcon,
  Layers,
  Percent,
  Repeat,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { Promotion } from "@/db/schema";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/misc";

const TYPE_META = {
  banner: {
    icon: ImageIcon,
    label: "Storefront banner",
    note: "Shown on the landing page hero",
  },
  first_order: {
    icon: Gift,
    label: "First order",
    note: "Applied automatically for guests with no previous orders",
  },
  happy_hour: {
    icon: Clock,
    label: "Happy hour",
    note: "Time-windowed discount, evaluated at checkout",
  },
  bogo: {
    icon: Repeat,
    label: "Buy one get one",
    note: "Matches a buy item with a free get item in the cart",
  },
  bundle: {
    icon: Layers,
    label: "Bundle",
    note: "Fixed price when a set of items are all in the cart",
  },
  birthday: {
    icon: Cake,
    label: "Birthday",
    note: "Gated to the days around a customer's birthday",
  },
  referral: {
    icon: Users,
    label: "Referral",
    note: "Give RM30, get RM30 — issues a voucher to the referred guest",
  },
} as const;

function describe(promo: Promotion) {
  const c = promo.config ?? {};
  const bits: string[] = [];
  if (c.percentOff) bits.push(`${c.percentOff}% off`);
  if (c.fixedOff) bits.push(`${money(c.fixedOff)} off`);
  if (c.startTime && c.endTime) bits.push(`${c.startTime}–${c.endTime}`);
  if (c.days?.length) {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    bits.push(c.days.map((d) => names[d]).join(", "));
  }
  if (c.bundlePrice) bits.push(`bundle at ${money(c.bundlePrice)}`);
  if (c.daysBefore) bits.push(`${c.daysBefore} days either side`);
  return bits;
}

export function PromotionList({
  promotions,
  referral,
}: {
  promotions: Promotion[];
  referral: { enabled: boolean; value: number };
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<number | null>(null);

  async function toggle(promo: Promotion) {
    setBusyId(promo.id);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "promotion",
          id: promo.id,
          active: !promo.active,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Couldn't update that promotion.");
        return;
      }
      toast.success(`${promo.title} ${promo.active ? "paused" : "activated"}`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {promotions.map((promo) => {
        const meta = TYPE_META[promo.type];
        const Icon = meta.icon;
        const details = describe(promo);

        return (
          <article
            key={promo.id}
            className="flex flex-wrap items-start gap-4 rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)] sm:flex-nowrap"
          >
            <span
              className={
                promo.active
                  ? "grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"
                  : "grid size-11 shrink-0 place-items-center rounded-xl bg-cream-200 text-ink-500"
              }
            >
              <Icon className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-medium text-ink-900">{promo.title}</p>
                <Badge variant="neutral">{meta.label}</Badge>
                {promo.active ? (
                  <Badge variant="success">Live</Badge>
                ) : (
                  <Badge variant="warning">Paused</Badge>
                )}
                {details.map((d) => (
                  <Badge key={d} variant="outline">
                    {d}
                  </Badge>
                ))}
              </div>
              <p className="mt-1 text-sm text-ink-500">{promo.description}</p>
              <p className="mt-1 text-xs text-ink-500/80">{meta.note}</p>

              {promo.type === "referral" && (
                <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-cream-100 px-2.5 py-1.5 text-xs text-ink-700">
                  <Percent className="size-3.5" />
                  Currently {referral.enabled ? "enabled" : "disabled"} at{" "}
                  {money(referral.value)} each way — change the amount in
                  Settings.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={promo.active}
                disabled={busyId === promo.id}
                onCheckedChange={() => toggle(promo)}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
