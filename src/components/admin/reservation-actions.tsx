"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ReservationStatus } from "@/db/schema";
import { Button } from "@/components/ui/button";

const NEXT_ACTION: Partial<
  Record<ReservationStatus, { to: ReservationStatus; label: string }>
> = {
  confirmed: { to: "seated", label: "Seat" },
  seated: { to: "completed", label: "Complete" },
};

/**
 * Front-of-house controls on a booking: seat the party, complete it, or mark
 * a no-show once they're clearly not coming.
 */
export function ReservationActions({
  reservationId,
  status,
}: {
  reservationId: number;
  status: ReservationStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const next = NEXT_ACTION[status];

  async function set(to: ReservationStatus, label: string) {
    setBusy(to);
    try {
      const res = await fetch(`/api/admin/reservations`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: reservationId, status: to }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't update that booking.");
        return;
      }
      toast.success(label);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (status === "completed" || status === "cancelled" || status === "no_show") {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {next && (
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={() => set(next.to, `Marked as ${next.to}`)}
        >
          {busy === next.to ? <Loader2 className="animate-spin" /> : null}
          {next.label}
        </Button>
      )}
      {status === "confirmed" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => set("no_show", "Marked as a no-show")}
        >
          {busy === "no_show" ? <Loader2 className="animate-spin" /> : null}
          No show
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={busy !== null}
        onClick={() => set("cancelled", "Booking cancelled")}
      >
        Cancel
      </Button>
    </div>
  );
}
