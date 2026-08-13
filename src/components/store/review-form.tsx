"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

/** Leaving a review credits 20 points — the review-solicitation loop in §D.4. */
export function ReviewForm({
  orderId,
  orderNumber,
}: {
  orderId: number;
  orderNumber: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const router = useRouter();

  if (done) {
    return (
      <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
        Thanks for reviewing {orderNumber} — 20 points are on their way.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-sm font-medium text-brand-700 underline underline-offset-2"
      >
        Leave a review · earn 20 points
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-cream-400 bg-cream-100 p-4">
      <p className="text-sm font-medium text-ink-900">
        How was {orderNumber}?
      </p>

      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            <Star
              className={cn(
                "size-6 transition",
                n <= rating
                  ? "fill-gold-500 text-gold-500"
                  : "text-cream-500 hover:text-gold-400",
              )}
            />
          </button>
        ))}
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What stood out?"
        className="mt-3"
      />

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={busy || rating === 0}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch("/api/reviews", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ orderId, rating, comment }),
              });
              const data = await res.json();
              if (!res.ok) {
                toast.error(data.error ?? "Couldn't save that review.");
                return;
              }
              setDone(true);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          Submit review
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
