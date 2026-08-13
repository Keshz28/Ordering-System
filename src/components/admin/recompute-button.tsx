"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Re-derives every customer's segment, LTV and behaviour flags from orders. */
export function RecomputeButton() {
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/admin/customers", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "recompute" }),
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error ?? "Recompute failed.");
            return;
          }
          toast.success(`Segments recalculated for ${data.customers} customers`);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      Recalculate segments
    </Button>
  );
}
