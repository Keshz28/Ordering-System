"use client";

import * as React from "react";
import { Check, Lock, QrCode, Smartphone } from "lucide-react";
import { FPX_BANKS, PAYMENT_OPTIONS } from "@/lib/payment-options";
import type { Order } from "@/db/schema";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PayMethod = Order["paymentMethod"];

/**
 * Malaysian checkout rails.
 *
 * Card-first checkout loses sales here — FPX online banking and DuitNow QR
 * carry the bulk of online payments, so they lead. Each option collects only
 * what a real gateway would need before redirecting, and settles through the
 * same simulated capture when no gateway key is configured.
 */
export function PaymentPicker({
  method,
  onMethodChange,
  detail,
  onDetailChange,
  cardNumber,
  onCardNumberChange,
}: {
  method: PayMethod;
  onMethodChange: (m: PayMethod) => void;
  detail: string;
  onDetailChange: (d: string) => void;
  cardNumber: string;
  onCardNumberChange: (v: string) => void;
}) {
  const options = PAYMENT_OPTIONS.filter((o) => !o.staffOnly);
  const selected = options.find((o) => o.id === method);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const active = o.id === method;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onMethodChange(o.id);
                onDetailChange(o.id === "fpx" ? FPX_BANKS[0] : "");
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition",
                active
                  ? "border-brand-700 bg-brand-50"
                  : "border-cream-400 bg-white hover:border-brand-300",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-12 shrink-0 place-items-center rounded-md border text-[10px] font-bold",
                  o.tint,
                )}
              >
                {o.mark}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-900">
                  {o.label}
                </span>
                <span className="block truncate text-xs text-ink-500">
                  {o.blurb}
                </span>
              </span>
              {active && (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-cream-400 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-ink-500">
          <Lock className="size-3.5" />
          Demo mode — no real charge is made, whichever method you pick.
        </div>

        {method === "fpx" && (
          <Field
            label="Choose your bank"
            htmlFor="fpx-bank"
            hint="You'd be redirected to your bank's login to authorise the payment."
          >
            <NativeSelect
              id="fpx-bank"
              value={detail || FPX_BANKS[0]}
              onChange={(e) => onDetailChange(e.target.value)}
            >
              {FPX_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        {method === "duitnow_qr" && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <QrCode className="size-24 text-ink-900" strokeWidth={1} />
            <div>
              <p className="text-sm font-medium text-ink-900">
                Scan with any banking or e-wallet app
              </p>
              <p className="mt-1 text-xs text-ink-500">
                DuitNow QR is accepted by every Malaysian bank, Touch &apos;n Go,
                GrabPay, Boost and ShopeePay.
              </p>
            </div>
          </div>
        )}

        {(method === "tng" ||
          method === "grabpay" ||
          method === "boost" ||
          method === "shopeepay") && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Smartphone className="size-8 text-brand-700" />
            <p className="text-sm font-medium text-ink-900">
              {selected?.label}
            </p>
            <p className="max-w-xs text-xs text-ink-500">
              In production this opens the wallet app to approve the payment.
              Here it settles instantly.
            </p>
          </div>
        )}

        {method === "card" && (
          <>
            <Field label="Card number" htmlFor="card">
              <Input
                id="card"
                value={cardNumber}
                onChange={(e) => onCardNumberChange(e.target.value)}
                className="font-mono tracking-wider"
                inputMode="numeric"
              />
            </Field>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Expiry">
                <Input defaultValue="12/34" className="font-mono" />
              </Field>
              <Field label="CVC">
                <Input defaultValue="123" className="font-mono" />
              </Field>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
