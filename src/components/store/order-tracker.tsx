"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bike,
  Check,
  ChefHat,
  CircleCheck,
  Clock,
  FastForward,
  Package,
  Printer,
  Receipt,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderItem, OrderStatus } from "@/db/schema";
import { STATUS_LABELS, stepsFor } from "@/lib/order-status";
import { cn, formatTime, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FullOrder = Order & { items: OrderItem[] };

const STEP_ICONS: Partial<Record<OrderStatus, typeof Check>> = {
  accepted: CircleCheck,
  preparing: ChefHat,
  ready: Package,
  dispatched: Bike,
  completed: Check,
};

export function OrderTracker({
  initialOrder,
  justPlaced,
}: {
  initialOrder: FullOrder;
  justPlaced: boolean;
}) {
  const [order, setOrder] = React.useState(initialOrder);
  const [advancing, setAdvancing] = React.useState(false);
  const terminal = ["completed", "canceled", "refunded"].includes(order.status);

  // Poll while the order is live. The API also runs the demo auto-pilot, so the
  // timeline advances on its own during a client walkthrough.
  React.useEffect(() => {
    if (terminal) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as FullOrder;
        setOrder((prev) => {
          if (next.status !== prev.status) {
            toast.success(`Order ${next.number}: ${STATUS_LABELS[next.status]}`);
          }
          return { ...next, placedAt: new Date(next.placedAt) };
        });
      } catch {
        /* transient network blip — the next tick retries */
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [order.id, order.number, terminal]);

  async function simulate() {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "POST" });
      const next = (await res.json()) as FullOrder;
      setOrder(next);
      toast.success(`Moved to ${STATUS_LABELS[next.status]}`);
    } finally {
      setAdvancing(false);
    }
  }

  const steps = stepsFor(order.type);
  const currentIndex =
    order.status === "new" ? -1 : steps.indexOf(order.status as OrderStatus);
  const eta = order.eta ? new Date(order.eta) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-5">
        {justPlaced && (
          <div className="flex items-start gap-3 rounded-card border border-emerald-200 bg-emerald-50 p-4">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-900">
                Order {order.number} is in.
              </p>
              <p className="text-sm text-emerald-800">
                We&apos;ve sent a confirmation to {order.guestEmail}. Watch it
                move through the kitchen below.
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------ timeline ---------------------------- */}
        <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-ink-900">
                {order.status === "canceled"
                  ? "Order canceled"
                  : order.status === "refunded"
                    ? "Order refunded"
                    : order.status === "completed"
                      ? "Delivered — enjoy"
                      : "Tracking your order"}
              </h2>
              <p className="text-sm text-ink-500">
                {order.type === "delivery"
                  ? "Delivery"
                  : order.type === "dine_in"
                    ? `Dine in · Table ${order.tableNumber}`
                    : `Takeaway · ${order.pickupSlot ?? "asap"}`}{" "}
                · placed {formatTime(new Date(order.placedAt))}
              </p>
            </div>
            {eta && !terminal && (
              <div className="rounded-2xl bg-cream-200 px-4 py-2 text-right">
                <p className="text-xs text-ink-500">Estimated</p>
                <p className="font-display text-lg text-ink-900">
                  {formatTime(eta)}
                </p>
              </div>
            )}
          </div>

          {order.status === "canceled" || order.status === "refunded" ? (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {order.cancelReason ??
                "This order was refunded in full to the original payment method."}
            </p>
          ) : (
            <ol className="mt-6 space-y-0">
              {steps.map((step, i) => {
                const done = i <= currentIndex;
                const active = i === currentIndex;
                const Icon = STEP_ICONS[step] ?? Check;
                return (
                  <li key={step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full border-2 transition",
                          done
                            ? "border-brand-700 bg-brand-700 text-white"
                            : "border-cream-400 bg-white text-ink-500",
                          active && "pulse-ring",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      {i < steps.length - 1 && (
                        <span
                          className={cn(
                            "w-0.5 flex-1 transition",
                            i < currentIndex ? "bg-brand-700" : "bg-cream-400",
                          )}
                          style={{ minHeight: "1.75rem" }}
                        />
                      )}
                    </div>
                    <div className={cn("pb-6", i === steps.length - 1 && "pb-0")}>
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          done ? "text-ink-900" : "text-ink-500",
                        )}
                      >
                        {STATUS_LABELS[step]}
                      </p>
                      <p className="text-xs text-ink-500">
                        {step === "accepted" && "The kitchen has your ticket."}
                        {step === "preparing" && "Your food is being cooked."}
                        {step === "ready" &&
                          (order.type === "delivery"
                            ? "Packed and waiting for a rider."
                            : "Ready for collection.")}
                        {step === "dispatched" && "On the way to you."}
                        {step === "completed" && "Buon appetito."}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {!terminal && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-cream-100 p-3">
              <Clock className="size-4 text-ink-500" />
              <span className="flex-1 text-xs text-ink-500">
                This tracker advances on its own in demo mode.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={simulate}
                disabled={advancing}
              >
                <FastForward className="size-3.5" /> Simulate next step
              </Button>
            </div>
          )}
        </section>

        {/* ------------------------------ receipt ----------------------------- */}
        <section
          id="receipt"
          className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl text-ink-900">
              <Receipt className="size-5 text-brand-700" /> Receipt
            </h2>
            <Button
              size="sm"
              variant="ghost"
              className="no-print"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" /> Print
            </Button>
          </div>

          <p className="mt-1 text-sm text-ink-500">
            {order.number} · {order.guestName} · {order.guestEmail}
          </p>

          <ul className="mt-4 space-y-2.5 border-b border-cream-300 pb-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 text-sm">
                <span className="text-ink-700">
                  <span className="font-medium text-ink-900">
                    {item.quantity}×
                  </span>{" "}
                  {item.name}
                  {(item.resolvedModifiers ?? []).length > 0 && (
                    <span className="block text-xs text-ink-500">
                      {(item.resolvedModifiers ?? [])
                        .map((m) => m.optionName)
                        .join(", ")}
                    </span>
                  )}
                  {item.note && (
                    <span className="mt-1 block rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
                      {item.note}
                    </span>
                  )}
                </span>
                <span className="tabular-nums whitespace-nowrap text-ink-700">
                  {money(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1.5 text-sm">
            <Row label="Subtotal" value={money(order.subtotal)} />
            {(order.appliedDiscounts ?? []).map((d, i) => (
              <Row
                key={i}
                label={d.label}
                value={`−${money(d.amount)}`}
                tone="discount"
              />
            ))}
            {order.deliveryFee > 0 && (
              <Row label="Delivery" value={money(order.deliveryFee)} />
            )}
            <Row label="Service charge" value={money(order.serviceCharge)} />
            <Row label="Tax" value={money(order.taxAmount)} />
            {order.tip > 0 && <Row label="Tip" value={money(order.tip)} />}
          </dl>

          <div className="mt-3 flex items-end justify-between border-t border-cream-300 pt-3">
            <span className="text-sm font-medium text-ink-700">Total paid</span>
            <span className="font-display text-2xl text-ink-900">
              {money(order.total)}
            </span>
          </div>

          {order.pointsEarned > 0 && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-gold-500/10 px-3.5 py-2.5 text-sm text-amber-900">
              <Sparkles className="size-4" />
              <span>
                <strong>
                  {order.pointsEarned.toLocaleString()} Bella Rewards points
                </strong>{" "}
                {order.status === "completed"
                  ? "credited to your account."
                  : "will land once your order completes."}
              </span>
            </p>
          )}
        </section>
      </div>

      {/* ------------------------------- sidebar ----------------------------- */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card border border-cream-400 bg-white p-5">
          <h3 className="text-sm font-semibold text-ink-900">Payment</h3>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-ink-500">Method</span>
            <span className="text-ink-900 capitalize">
              {order.paymentMethod.replace("_", " ")}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-ink-500">Status</span>
            <Badge
              variant={
                order.paymentStatus === "captured"
                  ? "success"
                  : order.paymentStatus === "refunded"
                    ? "danger"
                    : "warning"
              }
            >
              {order.paymentStatus}
            </Badge>
          </div>
        </div>

        <div className="rounded-card border border-cream-400 bg-white p-5">
          <h3 className="text-sm font-semibold text-ink-900">What now?</h3>
          <div className="mt-3 flex flex-col gap-2">
            <Button variant="outline" asChild>
              <Link href="/menu">Order something else</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/account/orders">See all my orders</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/kds">Open the kitchen view</Link>
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "discount";
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={cn("text-ink-500", tone === "discount" && "text-emerald-700")}>
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums text-ink-700",
          tone === "discount" && "font-medium text-emerald-700",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
