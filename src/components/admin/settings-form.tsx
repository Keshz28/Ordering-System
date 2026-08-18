"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { DeliveryZone, LoyaltyTier, Settings } from "@/db/schema";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function SettingsForm({
  settings,
  zones,
  tiers,
}: {
  settings: Settings;
  zones: DeliveryZone[];
  tiers: LoyaltyTier[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    restaurantName: settings.restaurantName,
    tagline: settings.tagline,
    currencySymbol: settings.currencySymbol,
    // Stored as a rate, edited as a percentage — less error-prone for an owner.
    serviceChargeRate: String((settings.serviceChargeRate * 100).toFixed(2)),
    taxRate: String((settings.taxRate * 100).toFixed(2)),
    address: settings.address,
    phone: settings.phone,
    referralEnabled: settings.referralEnabled,
    referralValue: String(settings.referralValue),
  });
  const [hours, setHours] = React.useState<
    Record<string, { open: string; close: string; closed?: boolean }>
  >(
    settings.openingHours && Object.keys(settings.openingHours).length > 0
      ? settings.openingHours
      : Object.fromEntries(
          DAYS.map((d) => [d, { open: "12:00", close: "22:00" }]),
        ),
  );

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "settings",
          restaurantName: form.restaurantName,
          tagline: form.tagline,
          currencySymbol: form.currencySymbol,
          serviceChargeRate: Number(form.serviceChargeRate) / 100,
          taxRate: Number(form.taxRate) / 100,
          address: form.address,
          phone: form.phone,
          referralEnabled: form.referralEnabled,
          referralValue: Number(form.referralValue) || 0,
          openingHours: hours,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save those settings.");
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------ business ----------------------------- */}
      <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg text-ink-900">Business</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Restaurant name">
            <Input
              value={form.restaurantName}
              onChange={(e) =>
                setForm({ ...form, restaurantName: e.target.value })
              }
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </Field>
          <Field label="Address">
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Service charge %" hint="Applied to post-discount food">
            <Input
              value={form.serviceChargeRate}
              inputMode="decimal"
              onChange={(e) =>
                setForm({ ...form, serviceChargeRate: e.target.value })
              }
            />
          </Field>
          <Field label="Tax %" hint="Applied after fees and delivery">
            <Input
              value={form.taxRate}
              inputMode="decimal"
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
            />
          </Field>
          <Field label="Currency symbol">
            <Input
              value={form.currencySymbol}
              onChange={(e) =>
                setForm({ ...form, currencySymbol: e.target.value })
              }
            />
          </Field>
        </div>
      </section>

      {/* ---------------------------- opening hours ------------------------- */}
      <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg text-ink-900">Opening hours</h2>
        <div className="mt-4 space-y-2">
          {DAYS.map((day) => {
            const value = hours[day] ?? { open: "12:00", close: "22:00" };
            return (
              <div key={day} className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-sm font-medium text-ink-700 capitalize">
                  {day}
                </span>
                <Input
                  value={value.open}
                  onChange={(e) =>
                    setHours({
                      ...hours,
                      [day]: { ...value, open: e.target.value },
                    })
                  }
                  className="w-28"
                  disabled={value.closed}
                />
                <span className="text-ink-500">to</span>
                <Input
                  value={value.close}
                  onChange={(e) =>
                    setHours({
                      ...hours,
                      [day]: { ...value, close: e.target.value },
                    })
                  }
                  className="w-28"
                  disabled={value.closed}
                />
                <label className="flex items-center gap-2 text-sm text-ink-500">
                  <Switch
                    checked={Boolean(value.closed)}
                    onCheckedChange={(v) =>
                      setHours({ ...hours, [day]: { ...value, closed: v } })
                    }
                  />
                  Closed
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {/* ----------------------------- referral ----------------------------- */}
      <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg text-ink-900">Referral program</h2>
        <p className="mt-1 text-sm text-ink-500">
          Give {money(Number(form.referralValue) || 0)}, get{" "}
          {money(Number(form.referralValue) || 0)} — the referred guest receives
          a voucher on their first order.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-3">
            <Switch
              checked={form.referralEnabled}
              onCheckedChange={(v) => setForm({ ...form, referralEnabled: v })}
            />
            <span className="text-sm text-ink-700">
              {form.referralEnabled ? "Enabled" : "Disabled"}
            </span>
          </label>
          <Field label="Reward each way" className="w-40">
            <Input
              value={form.referralValue}
              inputMode="decimal"
              onChange={(e) =>
                setForm({ ...form, referralValue: e.target.value })
              }
            />
          </Field>
        </div>
      </section>

      {/* --------------------------- delivery zones ------------------------- */}
      <ZoneEditor zones={zones} />

      {/* ----------------------------- tiers -------------------------------- */}
      <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg text-ink-900">Loyalty tiers</h2>
        <p className="mt-1 text-sm text-ink-500">
          Tiers use a rolling 12-month earning window. Points expire{" "}
          {settings.pointsExpiryMonths} months after they are earned.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border p-4"
              style={{ borderColor: `${t.color}55` }}
            >
              <p className="font-display text-lg" style={{ color: t.color }}>
                {t.name}
              </p>
              <p className="text-xs text-ink-500">
                From {t.minPoints.toLocaleString()} points
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-ink-700">
                <li>{t.earnRate} points per RM1</li>
                <li>
                  {t.discountRate > 0
                    ? `${Math.round(t.discountRate * 100)}% automatic discount`
                    : "No automatic discount"}
                </li>
                <li>{t.freeDelivery ? "Free delivery" : "Standard delivery"}</li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={save} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="size-4" /> Save settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ZoneEditor({ zones }: { zones: DeliveryZone[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [drafts, setDrafts] = React.useState<
    Record<number, { fee: string; minOrder: string; etaMinutes: string }>
  >(
    Object.fromEntries(
      zones.map((z) => [
        z.id,
        {
          fee: String(z.fee),
          minOrder: String(z.minOrder),
          etaMinutes: String(z.etaMinutes),
        },
      ]),
    ),
  );

  async function saveZone(zone: DeliveryZone) {
    const draft = drafts[zone.id];
    setBusyId(zone.id);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "zone",
          id: zone.id,
          fee: Number(draft.fee) || 0,
          minOrder: Number(draft.minOrder) || 0,
          etaMinutes: Number(draft.etaMinutes) || 30,
        }),
      });
      if (!res.ok) {
        toast.error("Couldn't update that zone.");
        return;
      }
      toast.success(`${zone.name} updated`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg text-ink-900">Delivery zones</h2>
      <p className="mt-1 text-sm text-ink-500">
        Fees and minimums are enforced at checkout — a guest below the minimum
        sees exactly how much more they need to add.
      </p>

      <div className="mt-4 space-y-3">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="flex flex-wrap items-end gap-3 rounded-2xl border border-cream-300 p-3.5"
          >
            <div className="min-w-32">
              <p className="text-sm font-medium text-ink-900">{zone.name}</p>
              <Badge variant="neutral">{zone.radiusKm} km radius</Badge>
            </div>
            <Field label="Fee" className="w-24">
              <Input
                value={drafts[zone.id]?.fee ?? ""}
                inputMode="decimal"
                onChange={(e) =>
                  setDrafts({
                    ...drafts,
                    [zone.id]: { ...drafts[zone.id], fee: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Min order" className="w-28">
              <Input
                value={drafts[zone.id]?.minOrder ?? ""}
                inputMode="decimal"
                onChange={(e) =>
                  setDrafts({
                    ...drafts,
                    [zone.id]: { ...drafts[zone.id], minOrder: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="ETA (min)" className="w-28">
              <Input
                value={drafts[zone.id]?.etaMinutes ?? ""}
                inputMode="numeric"
                onChange={(e) =>
                  setDrafts({
                    ...drafts,
                    [zone.id]: {
                      ...drafts[zone.id],
                      etaMinutes: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === zone.id}
              onClick={() => saveZone(zone)}
            >
              {busyId === zone.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Update"
              )}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
