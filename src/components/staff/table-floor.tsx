"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import type { RestaurantTable } from "@/db/schema";
import { cn, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Status = RestaurantTable["status"];

const STATUS_ORDER: Status[] = ["free", "occupied", "reserved", "cleaning"];

const STATUS_STYLES: Record<Status, { card: string; label: string; dot: string }> = {
  free: {
    card: "border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-400",
    label: "Free",
    dot: "bg-emerald-400",
  },
  occupied: {
    card: "border-brand-500/50 bg-brand-500/15 hover:border-brand-400",
    label: "Occupied",
    dot: "bg-brand-400",
  },
  reserved: {
    card: "border-sky-500/40 bg-sky-500/10 hover:border-sky-400",
    label: "Reserved",
    dot: "bg-sky-400",
  },
  cleaning: {
    card: "border-amber-500/40 bg-amber-500/10 hover:border-amber-400",
    label: "Cleaning",
    dot: "bg-amber-400",
  },
};

export function TableFloor({
  tables,
  orders,
}: {
  tables: RestaurantTable[];
  orders: { id: number; number: string; total: number; status: string }[];
}) {
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const router = useRouter();
  const orderById = new Map(orders.map((o) => [o.id, o]));

  const zones = Array.from(new Set(tables.map((t) => t.zone)));
  const counts = STATUS_ORDER.map((s) => ({
    status: s,
    n: tables.filter((t) => t.status === s).length,
  }));

  /** Tap cycles the status — fastest interaction on a busy service. */
  async function cycle(table: RestaurantTable) {
    const next =
      STATUS_ORDER[(STATUS_ORDER.indexOf(table.status) + 1) % STATUS_ORDER.length];
    setBusyId(table.id);
    try {
      const res = await fetch("/api/staff/tables", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: table.id, status: next }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Couldn't update that table.");
        return;
      }
      toast.success(`Table ${table.number} → ${STATUS_STYLES[next].label}`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Floor plan</h1>
          <p className="mt-1 text-sm text-white/50">
            Tap a table to cycle its status. Assigning an order occupies it
            automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {counts.map((c) => (
            <span
              key={c.status}
              className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs"
            >
              <span
                className={cn("size-2 rounded-full", STATUS_STYLES[c.status].dot)}
              />
              {STATUS_STYLES[c.status].label}
              <strong>{c.n}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {zones.map((zone) => (
          <section key={zone}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-white/50 uppercase">
              {zone}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
              {tables
                .filter((t) => t.zone === zone)
                .map((table) => {
                  const style = STATUS_STYLES[table.status];
                  const active = table.currentOrderId
                    ? orderById.get(table.currentOrderId)
                    : null;
                  return (
                    <div
                      key={table.id}
                      className={cn(
                        "rounded-2xl border-2 p-4 transition",
                        style.card,
                      )}
                    >
                      <button
                        onClick={() => cycle(table)}
                        disabled={busyId === table.id}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-display text-2xl leading-none">
                            {table.number}
                          </span>
                          {busyId === table.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <span
                              className={cn("mt-1 size-2.5 rounded-full", style.dot)}
                            />
                          )}
                        </div>
                        <p className="mt-2 flex items-center gap-1 text-xs text-white/60">
                          <Users className="size-3" /> {table.seats} seats
                        </p>
                        <p className="mt-1 text-xs font-medium">{style.label}</p>
                      </button>

                      {active && (
                        <Link
                          href={`/order/${active.id}`}
                          className="mt-2 block rounded-lg bg-black/25 px-2 py-1.5 text-[11px] transition hover:bg-black/40"
                        >
                          <span className="font-semibold">{active.number}</span>
                          <span className="ml-1 text-white/60">
                            {money(active.total)}
                          </span>
                          <Badge
                            variant="info"
                            className="mt-1 border-transparent bg-white/10 text-white/80"
                          >
                            {active.status}
                          </Badge>
                        </Link>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
