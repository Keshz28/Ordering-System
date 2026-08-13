"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, MoreHorizontal, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { OrderStatus } from "@/db/schema";
import { Button } from "@/components/ui/button";

const TERMINAL: OrderStatus[] = ["completed", "canceled", "refunded"];

export function OrderActions({
  orderId,
  status,
  canRefund,
}: {
  orderId: number;
  status: OrderStatus;
  canRefund: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  async function act(action: string, extra?: object) {
    setBusy(true);
    setOpen(false);
    try {
      const res = await fetch("/api/staff/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "That action failed.");
        return;
      }
      toast.success("Order updated");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex items-center justify-end gap-1">
      {!TERMINAL.includes(status) && (
        <Button
          size="iconSm"
          variant="ghost"
          disabled={busy}
          onClick={() => act("advance")}
          title="Advance to the next status"
        >
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : (
            <ChevronRight />
          )}
        </Button>
      )}

      <Button
        size="iconSm"
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        title="More actions"
      >
        <MoreHorizontal />
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full right-0 z-30 mt-1 w-52 overflow-hidden rounded-xl border border-cream-400 bg-white shadow-[var(--shadow-lift)]">
            {!TERMINAL.includes(status) && (
              <button
                onClick={() =>
                  act("cancel", { reason: "Canceled by staff from admin" })
                }
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-ink-700 transition hover:bg-cream-200"
              >
                <XCircle className="size-4" /> Cancel order
              </button>
            )}
            {canRefund && status !== "refunded" && (
              <button
                onClick={() => act("refund")}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-red-700 transition hover:bg-red-50"
              >
                <Undo2 className="size-4" /> Refund in full
              </button>
            )}
            {!canRefund && (
              <p className="px-3.5 py-2.5 text-xs text-ink-500">
                Refunds require an owner or manager.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
