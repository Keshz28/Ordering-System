"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function FavoriteToggle({
  menuItemId,
  initial = false,
  className,
}: {
  menuItemId: number;
  initial?: boolean;
  className?: string;
}) {
  const [saved, setSaved] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  return (
    <button
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        const nextState = !saved;
        setSaved(nextState);
        try {
          const res = await fetch("/api/account/favorites", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ menuItemId }),
          });
          if (res.status === 401) {
            setSaved(!nextState);
            toast.info("Sign in to save favourites.");
            return;
          }
          const data = await res.json();
          setSaved(data.saved);
          router.refresh();
        } catch {
          setSaved(!nextState);
        } finally {
          setBusy(false);
        }
      }}
      aria-label={saved ? "Remove from favourites" : "Save to favourites"}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border transition",
        saved
          ? "border-brand-300 bg-brand-50 text-brand-700"
          : "border-cream-500 bg-white text-ink-500 hover:border-brand-300 hover:text-brand-700",
        className,
      )}
    >
      <Heart className={cn("size-4", saved && "fill-current")} />
    </button>
  );
}
