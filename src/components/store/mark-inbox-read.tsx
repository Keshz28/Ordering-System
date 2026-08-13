"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarkInboxRead({ count }: { count: number }) {
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/notifications/read", { method: "POST" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <CheckCheck className="size-3.5" /> Mark {count} as read
    </Button>
  );
}
