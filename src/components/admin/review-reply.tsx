"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Reply } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function ReviewReply({ reviewId }: { reviewId: number }) {
  const [open, setOpen] = React.useState(false);
  const [reply, setReply] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="mt-3"
        onClick={() => setOpen(true)}
      >
        <Reply className="size-3.5" /> Reply
      </Button>
    );
  }

  return (
    <div className="mt-3">
      <Textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Thanks for the feedback…"
        autoFocus
      />
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          disabled={busy || reply.trim().length < 4}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch("/api/reviews", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id: reviewId, reply }),
              });
              const data = await res.json();
              if (!res.ok) {
                toast.error(data.error ?? "Couldn't post that reply.");
                return;
              }
              toast.success("Reply sent to the customer's inbox");
              setOpen(false);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Post reply"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
