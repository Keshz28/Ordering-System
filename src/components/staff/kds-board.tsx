"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  Loader2,
  RefreshCw,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderItem, OrderStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/order-status";
import { cn, formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Ticket = Order & { items: OrderItem[] };

const COLUMNS: { status: OrderStatus; label: string; hint: string }[] = [
  { status: "new", label: "Incoming", hint: "Accept to start the clock" },
  { status: "accepted", label: "Queued", hint: "Waiting on a station" },
  { status: "preparing", label: "On the pass", hint: "Being cooked" },
  { status: "ready", label: "Ready", hint: "Waiting for pickup" },
];

const TYPE_ICON = {
  dine_in: UtensilsCrossed,
  takeout: Store,
  delivery: Bike,
};

/** SLA colouring: under 15 min green, 15–25 amber, past 25 red. */
function slaTone(minutes: number) {
  if (minutes >= 25) return "danger";
  if (minutes >= 15) return "warn";
  return "ok";
}

const TONE_STYLES = {
  ok: {
    card: "border-emerald-500/40",
    chip: "bg-emerald-500/15 text-emerald-300",
    bar: "bg-emerald-500",
  },
  warn: {
    card: "border-amber-500/50",
    chip: "bg-amber-500/15 text-amber-300",
    bar: "bg-amber-500",
  },
  danger: {
    card: "border-red-500/60 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]",
    chip: "bg-red-500/20 text-red-300",
    bar: "bg-red-500",
  },
};

export function KdsBoard({
  initialTickets,
  canCancel,
}: {
  initialTickets: Ticket[];
  canCancel: boolean;
}) {
  const [tickets, setTickets] = React.useState(initialTickets);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [refreshing, setRefreshing] = React.useState(false);

  // Timers tick locally; the ticket list refetches on its own cadence.
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/staff/orders?scope=live", {
        cache: "no-store",
      });
      if (!res.ok) return;
      setTickets(await res.json());
    } catch {
      /* keep the last good board on a transient failure */
    }
  }, []);

  React.useEffect(() => {
    const t = setInterval(load, 7000);
    return () => clearInterval(t);
  }, [load]);

  async function act(orderId: number, action: string, extra?: object) {
    setBusyId(orderId);
    try {
      const res = await fetch("/api/staff/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "That didn't work.");
        return;
      }
      toast.success(
        action === "cancel"
          ? `Order ${data.number} canceled`
          : `${data.number} → ${STATUS_LABELS[data.status as OrderStatus]}`,
      );
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const late = tickets.filter(
    (t) => (now - new Date(t.placedAt).getTime()) / 60000 >= 25,
  ).length;

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Kitchen display</h1>
          <p className="mt-1 text-sm text-white/50">
            {tickets.length} live ticket{tickets.length === 1 ? "" : "s"}
            {late > 0 ? ` · ${late} past 25 minutes` : " · all within SLA"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {late > 0 && (
            <Badge variant="danger" className="border-red-500/50 bg-red-500/15 text-red-300">
              <AlertTriangle className="size-3" /> {late} late
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          >
            {refreshing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = tickets.filter((t) => t.status === col.status);
          return (
            <section key={col.status} className="flex flex-col">
              <header className="mb-3 flex items-center justify-between rounded-xl bg-white/5 px-3.5 py-2.5">
                <div>
                  <p className="text-sm font-semibold">{col.label}</p>
                  <p className="text-[11px] text-white/40">{col.hint}</p>
                </div>
                <span className="grid size-7 place-items-center rounded-full bg-white/10 text-sm font-bold">
                  {items.length}
                </span>
              </header>

              <div className="flex flex-col gap-3">
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-xs text-white/30">
                    Nothing here
                  </p>
                ) : (
                  items.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      now={now}
                      busy={busyId === ticket.id}
                      canCancel={canCancel}
                      onAdvance={() => act(ticket.id, "advance")}
                      onCancel={() =>
                        act(ticket.id, "cancel", {
                          reason: "Canceled from the kitchen display",
                        })
                      }
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TicketCard({
  ticket,
  now,
  busy,
  canCancel,
  onAdvance,
  onCancel,
}: {
  ticket: Ticket;
  now: number;
  busy: boolean;
  canCancel: boolean;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  // The clock starts when the kitchen accepted it, falling back to placement.
  const from = new Date(ticket.acceptedAt ?? ticket.placedAt).getTime();
  const elapsedMs = Math.max(0, now - from);
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  const tone = TONE_STYLES[slaTone(minutes)];
  const TypeIcon = TYPE_ICON[ticket.type];

  const grouped = {
    starter: ticket.items.filter((i) => i.course === "starter"),
    main: ticket.items.filter((i) => i.course === "main"),
    dessert: ticket.items.filter((i) => i.course === "dessert"),
    drink: ticket.items.filter((i) => i.course === "drink"),
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border-2 bg-ink-700/60 transition",
        tone.card,
      )}
    >
      <div className={cn("h-1 w-full", tone.bar)} />

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-lg leading-none">{ticket.number}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
              <TypeIcon className="size-3.5" />
              {ticket.type === "dine_in"
                ? `Table ${ticket.tableNumber}`
                : ticket.type === "takeout"
                  ? `Pickup ${ticket.pickupSlot ?? "asap"}`
                  : "Delivery"}
              · {formatTime(new Date(ticket.placedAt))}
            </p>
          </div>
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-sm font-bold tabular-nums",
              tone.chip,
            )}
          >
            <Clock className="size-3.5" />
            {minutes}:{String(seconds).padStart(2, "0")}
          </span>
        </div>

        <div className="mt-3 space-y-2.5">
          {(
            [
              ["starter", "Starters"],
              ["main", "Mains"],
              ["dessert", "Desserts"],
              ["drink", "Drinks"],
            ] as const
          ).map(([key, label]) =>
            grouped[key].length === 0 ? null : (
              <div key={key}>
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-white/35 uppercase">
                  {label}
                </p>
                <ul className="space-y-1.5">
                  {grouped[key].map((item) => (
                    <li
                      key={item.id}
                      className={cn("text-sm", item.voided && "line-through opacity-40")}
                    >
                      <div className="flex gap-2">
                        <span className="font-bold text-brand-300">
                          {item.quantity}×
                        </span>
                        <span className="flex-1">{item.name}</span>
                      </div>
                      {(item.resolvedModifiers ?? []).length > 0 && (
                        <p className="mt-0.5 pl-6 text-xs text-white/50">
                          {(item.resolvedModifiers ?? [])
                            .map((m) => m.optionName)
                            .join(" · ")}
                        </p>
                      )}
                      {item.note && (
                        <p className="mt-1 ml-6 rounded-md bg-amber-400/20 px-2 py-1 text-xs font-medium text-amber-200">
                          {item.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>

        {ticket.note && (
          <p className="mt-3 rounded-lg bg-amber-400/20 px-2.5 py-1.5 text-xs font-medium text-amber-200">
            Order note: {ticket.note}
          </p>
        )}

        <div className="mt-3.5 flex gap-2">
          <Button
            className="flex-1"
            size="sm"
            disabled={busy}
            onClick={onAdvance}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : ticket.status === "new" ? (
              <>
                <CheckCircle2 className="size-3.5" /> Accept
              </>
            ) : ticket.status === "ready" ? (
              <>
                <CheckCircle2 className="size-3.5" />
                {ticket.type === "delivery" ? "Dispatch" : "Complete"}
              </>
            ) : (
              <>
                <ChefHat className="size-3.5" /> Bump
              </>
            )}
          </Button>
          {canCancel && (
            <Button
              size="sm"
              variant="ghost"
              className="text-white/50 hover:bg-red-500/15 hover:text-red-300"
              disabled={busy}
              onClick={onCancel}
            >
              Void
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
