"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn, money } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";

type VoucherType = "percent_off" | "fixed_off" | "free_item" | "free_delivery";

/** Quick presets — the owner rarely wants to think about the numbers. */
const PRESETS: { label: string; type: VoucherType; value: number; minSpend: number }[] = [
  { label: "$5 off", type: "fixed_off", value: 5, minSpend: 20 },
  { label: "$10 off", type: "fixed_off", value: 10, minSpend: 35 },
  { label: "15% off", type: "percent_off", value: 15, minSpend: 0 },
  { label: "Free delivery", type: "free_delivery", value: 0, minSpend: 0 },
];

/**
 * The owner-to-customer loop: pick a gift, send it, and it lands in that
 * customer's "My offers" tab and Inbox immediately.
 */
export function IssueVoucherCard({
  customerId,
  customerName,
  items,
}: {
  customerId: number;
  customerName: string;
  items: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [type, setType] = React.useState<VoucherType>("fixed_off");
  const [value, setValue] = React.useState("5");
  const [minSpend, setMinSpend] = React.useState("20");
  const [expiryDays, setExpiryDays] = React.useState("30");
  const [freeItemId, setFreeItemId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [issued, setIssued] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "issue_voucher",
          customerId,
          type,
          value: Number(value) || 0,
          minSpend: Number(minSpend) || 0,
          expiryDays: Number(expiryDays) || 30,
          freeItemId: freeItemId ? Number(freeItemId) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't issue that voucher.");
        return;
      }
      setIssued(data.code);
      toast.success(
        `${data.code} sent to ${customerName} — it's already in their offers.`,
        { duration: 6000 },
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border-2 border-brand-200 bg-brand-50/40 p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-700 text-white">
          <Gift className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink-900">
            Issue a personal voucher
          </h2>
          <p className="text-xs text-ink-500">
            Appears instantly in their offers
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {PRESETS.map((p) => {
          const active =
            type === p.type &&
            Number(value) === p.value &&
            Number(minSpend) === p.minSpend;
          return (
            <button
              key={p.label}
              onClick={() => {
                setType(p.type);
                setValue(String(p.value));
                setMinSpend(String(p.minSpend));
                setIssued(null);
              }}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-medium transition",
                active
                  ? "border-brand-600 bg-brand-700 text-white"
                  : "border-cream-400 bg-white text-ink-700 hover:border-brand-300",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2.5">
        <Field label="Reward type">
          <NativeSelect
            value={type}
            onChange={(e) => {
              setType(e.target.value as VoucherType);
              setIssued(null);
            }}
          >
            <option value="fixed_off">Fixed amount off</option>
            <option value="percent_off">Percent off</option>
            <option value="free_item">Free item</option>
            <option value="free_delivery">Free delivery</option>
          </NativeSelect>
        </Field>

        {type === "free_item" ? (
          <Field label="Which item">
            <NativeSelect
              value={freeItemId}
              onChange={(e) => setFreeItemId(e.target.value)}
            >
              <option value="">Choose…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : type !== "free_delivery" ? (
          <Field label={type === "percent_off" ? "Percent off" : "Amount off"}>
            <Input
              value={value}
              inputMode="decimal"
              onChange={(e) => {
                setValue(e.target.value);
                setIssued(null);
              }}
            />
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Min spend">
            <Input
              value={minSpend}
              inputMode="decimal"
              onChange={(e) => setMinSpend(e.target.value)}
            />
          </Field>
          <Field label="Expires in (days)">
            <Input
              value={expiryDays}
              inputMode="numeric"
              onChange={(e) => setExpiryDays(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <Button
        className="mt-3 w-full"
        onClick={submit}
        disabled={busy || (type === "free_item" && !freeItemId)}
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Issuing…
          </>
        ) : (
          <>
            <Gift className="size-4" /> Send to {customerName.split(" ")[0]}
          </>
        )}
      </Button>

      {issued && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <Check className="size-4 shrink-0" />
          <span>
            Sent — code{" "}
            <strong className="font-mono tracking-wider">{issued}</strong>. Ask
            them to refresh &ldquo;My offers&rdquo;.
          </span>
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
        Personal vouchers are single-use, locked to this customer&apos;s account,
        and stack with their tier discount.{" "}
        {type === "fixed_off" && Number(minSpend) > 0
          ? `Worth ${money(Number(value) || 0)} on orders over ${money(Number(minSpend) || 0)}.`
          : ""}
      </p>
    </section>
  );
}
