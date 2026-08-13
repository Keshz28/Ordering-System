"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Tag, Target } from "lucide-react";
import { toast } from "sonner";
import type { Voucher } from "@/db/schema";
import { cn, formatDate, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/data";

type Performance = {
  redemptions: number;
  discount: number;
  revenue: number;
  roi: number | null;
} | null;

/** `expired` is decided on the server so the client never does date maths
 *  during render — that would risk a hydration mismatch at a window boundary. */
type Row = Voucher & { performance: Performance; expired: boolean };

const TYPE_LABELS = {
  percent_off: "% off",
  fixed_off: "$ off",
  free_item: "Free item",
  free_delivery: "Free delivery",
};

export function VoucherManager({
  vouchers,
  items,
}: {
  vouchers: Row[];
  items: { id: number; name: string; price: number }[];
}) {
  const [creating, setCreating] = React.useState(false);
  const router = useRouter();

  const live = vouchers.filter((v) => v.active && !v.expired && !v.targeted);
  const targeted = vouchers.filter((v) => v.targeted);
  const inactive = vouchers.filter(
    (v) => !v.targeted && (!v.active || v.expired),
  );

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New voucher
        </Button>
      </div>

      <Section
        title="Live vouchers"
        description="Publicly usable at checkout right now"
        rows={live}
        router={router}
      />

      {targeted.length > 0 && (
        <Section
          title="Personal vouchers"
          description="Issued to a specific customer from the CRM, a campaign or a points redemption"
          rows={targeted.slice(0, 12)}
          router={router}
          compact
        />
      )}

      {inactive.length > 0 && (
        <Section
          title="Expired & paused"
          description="Kept for reporting — reactivate any of them"
          rows={inactive}
          router={router}
        />
      )}

      <VoucherBuilder
        open={creating}
        items={items}
        onClose={() => setCreating(false)}
      />
    </>
  );
}

function Section({
  title,
  description,
  rows,
  router,
  compact,
}: {
  title: string;
  description: string;
  rows: Row[];
  router: ReturnType<typeof useRouter>;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <section>
        <h2 className="font-display text-xl text-ink-900">{title}</h2>
        <p className="mb-3 text-sm text-ink-500">{description}</p>
        <EmptyState
          icon={Tag}
          title="Nothing here yet"
          description="Create a voucher to get started."
        />
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      <p className="mb-3 text-sm text-ink-500">{description}</p>

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((v) => (
          <VoucherCard key={v.id} voucher={v} router={router} compact={compact} />
        ))}
      </div>
    </section>
  );
}

function VoucherCard({
  voucher: v,
  router,
  compact,
}: {
  voucher: Row;
  router: ReturnType<typeof useRouter>;
  compact?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const expired = v.expired;

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: v.id, active: !v.active }),
      });
      if (!res.ok) {
        toast.error("Couldn't update that voucher.");
        return;
      }
      toast.success(`${v.code} ${v.active ? "paused" : "reactivated"}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={cn(
        "rounded-card border bg-white p-4 shadow-[var(--shadow-card)]",
        v.active && !expired ? "border-cream-400" : "border-cream-400 opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-base font-bold text-brand-800">
              {v.code}
            </span>
            <Badge variant="neutral">{TYPE_LABELS[v.type]}</Badge>
            {v.stackable && <Badge variant="info">Stackable</Badge>}
            {v.targeted && (
              <Badge variant="gold">
                <Target className="size-3" /> Personal
              </Badge>
            )}
            {expired && <Badge variant="danger">Expired</Badge>}
            {!v.active && !expired && <Badge variant="warning">Paused</Badge>}
          </div>
          <p className="mt-1 text-sm font-medium text-ink-900">{v.title}</p>
          {!compact && v.description && (
            <p className="text-xs text-ink-500">{v.description}</p>
          )}
        </div>

        {!v.targeted && (
          <Switch checked={v.active} onCheckedChange={toggle} disabled={busy} />
        )}
      </div>

      {!compact && (
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-cream-300 pt-3 text-xs text-ink-500">
          <li>
            Value:{" "}
            <strong className="text-ink-900">
              {v.type === "percent_off"
                ? `${v.value}%`
                : v.type === "fixed_off"
                  ? money(v.value)
                  : "—"}
            </strong>
          </li>
          <li>
            Min spend:{" "}
            <strong className="text-ink-900">
              {v.minSpend > 0 ? money(v.minSpend) : "none"}
            </strong>
          </li>
          <li>
            Per customer:{" "}
            <strong className="text-ink-900">
              {v.perCustomerLimit ?? "unlimited"}
            </strong>
          </li>
          <li>
            Total cap:{" "}
            <strong className="text-ink-900">
              {v.usageLimit ?? "unlimited"}
            </strong>
          </li>
          <li>
            Order types:{" "}
            <strong className="text-ink-900">
              {(v.orderTypes ?? []).length === 3
                ? "all"
                : (v.orderTypes ?? []).map((t) => t.replace("_", "-")).join(", ")}
            </strong>
          </li>
          <li>
            Ends:{" "}
            <strong className="text-ink-900">
              {v.validTo ? formatDate(v.validTo) : "no end date"}
            </strong>
          </li>
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cream-300 pt-3">
        <Badge variant="neutral">{v.usesCount} redemptions</Badge>
        {v.performance && (
          <>
            <Badge variant="warning">
              −{money(v.performance.discount)} discounted
            </Badge>
            <Badge variant="success">
              {money(v.performance.revenue)} revenue
            </Badge>
            {v.performance.roi !== null && (
              <Badge variant={v.performance.roi > 3 ? "success" : "warning"}>
                {v.performance.roi.toFixed(1)}× ROI
              </Badge>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function VoucherBuilder({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: { id: number; name: string; price: number }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    code: "",
    title: "",
    description: "",
    type: "percent_off" as Voucher["type"],
    value: "10",
    minSpend: "0",
    freeItemId: "",
    orderTypes: ["dine_in", "takeout", "delivery"] as (
      | "dine_in"
      | "takeout"
      | "delivery"
    )[],
    validTo: "",
    usageLimit: "",
    perCustomerLimit: "1",
    stackable: false,
  });

  if (!open) return null;

  function toggleType(t: "dine_in" | "takeout" | "delivery") {
    setForm((f) => ({
      ...f,
      orderTypes: f.orderTypes.includes(t)
        ? f.orderTypes.filter((x) => x !== t)
        : [...f.orderTypes, t],
    }));
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          title: form.title,
          description: form.description || null,
          type: form.type,
          value: Number(form.value) || 0,
          minSpend: Number(form.minSpend) || 0,
          freeItemId: form.freeItemId ? Number(form.freeItemId) : null,
          orderTypes: form.orderTypes,
          validTo: form.validTo || null,
          usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
          perCustomerLimit: form.perCustomerLimit
            ? Number(form.perCustomerLimit)
            : null,
          stackable: form.stackable,
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't create that voucher.");
        return;
      }
      toast.success(`${data.code} is live — try it at checkout`);
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="center" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Build a voucher</DialogTitle>
          <DialogDescription>
            Every rule below is validated server-side when a guest applies the
            code.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto px-5 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="SUMMER20"
                className="font-mono tracking-wider uppercase"
              />
            </Field>
            <Field label="Type">
              <NativeSelect
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as Voucher["type"] })
                }
              >
                <option value="percent_off">Percent off</option>
                <option value="fixed_off">Fixed amount off</option>
                <option value="free_item">Free item</option>
                <option value="free_delivery">Free delivery</option>
              </NativeSelect>
            </Field>
          </div>

          <Field label="Customer-facing title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="20% off your summer order"
            />
          </Field>

          <Field label="Description (optional)">
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Shown on the offers page"
              className="min-h-16"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            {form.type !== "free_delivery" && form.type !== "free_item" && (
              <Field
                label={form.type === "percent_off" ? "Percent" : "Amount"}
              >
                <Input
                  value={form.value}
                  inputMode="decimal"
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </Field>
            )}
            {form.type === "free_item" && (
              <Field label="Free item">
                <NativeSelect
                  value={form.freeItemId}
                  onChange={(e) =>
                    setForm({ ...form, freeItemId: e.target.value })
                  }
                >
                  <option value="">Choose an item…</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({money(i.price)})
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Minimum spend">
              <Input
                value={form.minSpend}
                inputMode="decimal"
                onChange={(e) => setForm({ ...form, minSpend: e.target.value })}
              />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-700">
              Valid on which order types
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["dine_in", "Dine-in"],
                  ["takeout", "Takeaway"],
                  ["delivery", "Delivery"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleType(value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                    form.orderTypes.includes(value)
                      ? "border-brand-600 bg-brand-50 text-brand-800"
                      : "border-cream-400 bg-white text-ink-500",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Ends on" hint="Blank = never">
              <Input
                type="date"
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
              />
            </Field>
            <Field label="Total uses" hint="Blank = ∞">
              <Input
                value={form.usageLimit}
                inputMode="numeric"
                placeholder="∞"
                onChange={(e) =>
                  setForm({ ...form, usageLimit: e.target.value })
                }
              />
            </Field>
            <Field label="Per customer" hint="Blank = ∞">
              <Input
                value={form.perCustomerLimit}
                inputMode="numeric"
                onChange={(e) =>
                  setForm({ ...form, perCustomerLimit: e.target.value })
                }
              />
            </Field>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-cream-400 px-3.5 py-3">
            <Switch
              checked={form.stackable}
              onCheckedChange={(v) => setForm({ ...form, stackable: v })}
            />
            <span className="text-sm text-ink-700">
              Stackable
              <span className="block text-xs text-ink-500">
                Allow this alongside automatic promotions. Tier discounts always
                stack regardless.
              </span>
            </span>
          </label>
        </div>

        <div className="flex gap-2 border-t border-cream-400 p-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={busy || !form.code || !form.title || form.orderTypes.length === 0}
            onClick={submit}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Create voucher"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
