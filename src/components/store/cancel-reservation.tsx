"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CancelReservation({
  reservationId,
  reference,
  when,
}: {
  reservationId: number;
  reference: string;
  when: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function cancel() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations?id=${reservationId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't cancel that booking.");
        return;
      }
      toast.success(`${reference} cancelled — the table is back in the pool.`);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            {reference} — {when}. The table goes straight back into the pool for
            other guests, and this can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={cancel} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" /> Cancelling…
              </>
            ) : (
              "Cancel booking"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
