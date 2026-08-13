"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";

export function RedeemCard({
  reward,
  balance,
}: {
  reward: {
    id: number;
    name: string;
    description: string | null;
    pointsCost: number;
    minSpend: number;
    validDays: number;
    freeItemName: string | null;
  };
  balance: number;
}) {
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState<string | null>(null);
  const router = useRouter();

  const affordable = balance >= reward.pointsCost;
  const shortfall = reward.pointsCost - balance;

  return (
    <div className="flex flex-col rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-10 place-items-center rounded-xl bg-gold-500/15 text-gold-600">
          <Gift className="size-5" />
        </span>
        <Badge variant={affordable ? "gold" : "neutral"}>
          {reward.pointsCost.toLocaleString()} pts
        </Badge>
      </div>

      <p className="mt-3 font-display text-lg leading-tight text-ink-900">
        {reward.name}
      </p>
      <p className="mt-1 text-xs text-ink-500">
        {reward.description}
        {reward.freeItemName ? ` — ${reward.freeItemName}` : ""}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {reward.minSpend > 0 && (
          <Badge variant="outline">Min {money(reward.minSpend)}</Badge>
        )}
        <Badge variant="outline">Valid {reward.validDays} days</Badge>
      </div>

      {!affordable && (
        <div className="mt-3">
          <Progress value={(balance / reward.pointsCost) * 100} />
          <p className="mt-1 text-xs text-ink-500">
            {shortfall.toLocaleString()} points to go
          </p>
        </div>
      )}

      {code ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-sm text-emerald-800">
          Unlocked — code{" "}
          <strong className="font-mono tracking-wider">{code}</strong>
        </p>
      ) : (
        <Button
          className="mt-4 w-full"
          disabled={!affordable || busy}
          variant={affordable ? "default" : "secondary"}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch("/api/loyalty/redeem", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ redemptionId: reward.id }),
              });
              const data = await res.json();
              if (!res.ok) {
                toast.error(data.error ?? "Couldn't redeem that.");
                return;
              }
              setCode(data.code);
              toast.success(`${reward.name} added to My offers`);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Redeeming…
            </>
          ) : affordable ? (
            "Redeem now"
          ) : (
            <>
              <Lock className="size-3.5" /> Not enough points
            </>
          )}
        </Button>
      )}
    </div>
  );
}
