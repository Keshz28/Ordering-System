"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, LayoutGrid, Map as MapIcon, Users } from "lucide-react";
import { toast } from "sonner";
import type { RestaurantTable } from "@/db/schema";
import { FloorCanvas, shapeClass, type PlanTable } from "@/components/floor/floor-canvas";
import { floorPlanFor } from "@/lib/floor-plans";
import { cn } from "@/lib/utils";

export type TableBooking = {
  id: number;
  reference: string;
  name: string;
  partySize: number;
  time: string;
  status: "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
  isNext: boolean;
};

export type FloorTableState = {
  table: RestaurantTable;
  /** Stored status reconciled with today's bookings — see floorStateFor(). */
  effectiveStatus: RestaurantTable["status"];
  bookings: TableBooking[];
};

type Status = RestaurantTable["status"];

const STATUS_ORDER: Status[] = ["free", "occupied", "reserved", "cleaning"];

const STATUS_STYLE: Record<Status, { shape: string; dot: string; label: string }> =
  {
    free: {
      shape: "border-emerald-500/70 bg-emerald-500/12 text-emerald-100",
      dot: "bg-emerald-400",
      label: "Free",
    },
    occupied: {
      shape: "border-rose-500/70 bg-rose-500/15 text-rose-100",
      dot: "bg-rose-400",
      label: "Occupied",
    },
    reserved: {
      shape: "border-sky-500/70 bg-sky-500/15 text-sky-100",
      dot: "bg-sky-400",
      label: "Reserved",
    },
    cleaning: {
      shape: "border-amber-500/70 bg-amber-500/15 text-amber-100",
      dot: "bg-amber-300",
      label: "Cleaning",
    },
  };

/**
 * The room as the host sees it.
 *
 * Same geometry as the guest booking map, but coloured by live status and
 * annotated with who is arriving — a host thinks "the six-top at the back",
 * not "table 11", so the spatial view is the one that matches the job.
 * The list view stays available because it is better for filtering and for
 * reading dense text.
 */
export function StaffFloorPlan({
  branchSlug,
  branchName,
  floorNote,
  tables,
}: {
  branchSlug: string;
  branchName: string;
  floorNote?: string | null;
  tables: FloorTableState[];
}) {
  const router = useRouter();
  const [view, setView] = React.useState<"plan" | "list">("plan");
  const [busy, setBusy] = React.useState<number | null>(null);
  const plan = floorPlanFor(branchSlug);

  const byId = React.useMemo(
    () => new Map(tables.map((t) => [t.table.id, t])),
    [tables],
  );

  const counts = React.useMemo(() => {
    const c: Record<Status, number> = {
      free: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
    };
    for (const t of tables) c[t.effectiveStatus] += 1;
    return c;
  }, [tables]);

  const coversBooked = tables.reduce(
    (sum, t) =>
      sum +
      t.bookings
        .filter((b) => b.status === "confirmed" || b.status === "seated")
        .reduce((s, b) => s + b.partySize, 0),
    0,
  );

  async function cycle(id: number, current: Status) {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % 4];
    setBusy(id);
    try {
      const res = await fetch("/api/staff/tables", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't update that table.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-white">Floor plan</h1>
          <p className="text-sm text-white/60">
            {branchName} · {coversBooked} cover{coversBooked === 1 ? "" : "s"}{" "}
            booked today. Tap a table to cycle its status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_ORDER.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/80"
              >
                <span className={cn("size-2 rounded-full", STATUS_STYLE[s].dot)} />
                {STATUS_STYLE[s].label}
                <b className="text-white">{counts[s]}</b>
              </span>
            ))}
          </div>

          <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-0.5">
            {(
              [
                { id: "plan", label: "Plan", icon: MapIcon },
                { id: "list", label: "List", icon: LayoutGrid },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                  view === v.id
                    ? "bg-white text-ink-900"
                    : "text-white/70 hover:text-white",
                )}
              >
                <v.icon className="size-3.5" />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {floorNote && view === "plan" && (
        <p className="max-w-3xl text-sm text-white/50">{floorNote}</p>
      )}

      {view === "plan" ? (
        <div className="mx-auto w-full max-w-5xl">
          <FloorCanvas
            plan={plan}
            tables={tables.map((t) => t.table as PlanTable)}
            className="border-white/10 bg-[linear-gradient(180deg,#1f1c1a,#171412)] shadow-none"
            renderTable={(t) => {
              const state = byId.get(t.id);
              if (!state) return null;
              const style = STATUS_STYLE[state.effectiveStatus];
              const next = state.bookings.find((b) => b.isNext);
              return (
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => cycle(t.id, state.table.status)}
                  title={`${t.label ?? `Table ${t.number}`} · ${t.seats} seats · ${style.label}${
                    next ? ` · next ${next.time} ${next.name} (${next.partySize})` : ""
                  }`}
                  className={cn(
                    "flex size-full flex-col items-center justify-center border-2 px-0.5 transition",
                    shapeClass(t.shape),
                    style.shape,
                    busy === t.id && "opacity-50",
                    "hover:brightness-125",
                  )}
                >
                  <span className="text-[10px] leading-none font-bold sm:text-xs">
                    {t.label ?? t.number}
                  </span>
                  <span className="mt-0.5 hidden items-center gap-0.5 text-[8px] leading-none opacity-70 sm:flex">
                    <Users className="size-2.5" />
                    {t.seats}
                  </span>
                  {next && (
                    <span className="mt-0.5 hidden truncate text-[8px] leading-none font-semibold text-white/90 md:block">
                      {next.time}
                    </span>
                  )}
                </button>
              );
            }}
          />
        </div>
      ) : (
        <ListView tables={tables} onCycle={cycle} busy={busy} />
      )}

      <UpcomingStrip tables={tables} />
    </div>
  );
}

function ListView({
  tables,
  onCycle,
  busy,
}: {
  tables: FloorTableState[];
  onCycle: (id: number, s: Status) => void;
  busy: number | null;
}) {
  const zones = [...new Set(tables.map((t) => t.table.zone))];
  return (
    <div className="flex flex-col gap-5">
      {zones.map((zone) => (
        <section key={zone}>
          <h2 className="mb-2 text-xs font-semibold tracking-[0.18em] text-white/40 uppercase">
            {zone}
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables
              .filter((t) => t.table.zone === zone)
              .map(({ table, effectiveStatus, bookings }) => {
                const style = STATUS_STYLE[effectiveStatus];
                const next = bookings.find((b) => b.isNext);
                return (
                  <button
                    key={table.id}
                    type="button"
                    disabled={busy === table.id}
                    onClick={() => onCycle(table.id, table.status)}
                    className={cn(
                      "rounded-2xl border-2 p-3.5 text-left transition hover:brightness-125",
                      style.shape,
                      busy === table.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-2xl leading-none text-white">
                        {table.label ?? table.number}
                      </span>
                      <span className={cn("mt-1 size-2 rounded-full", style.dot)} />
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-white/60">
                      <Users className="size-3" /> {table.seats} seats
                    </p>
                    <p className="text-sm font-medium text-white">{style.label}</p>
                    {next && (
                      <p className="mt-1.5 flex items-center gap-1 truncate rounded-md bg-black/25 px-1.5 py-1 text-[11px] text-white/80">
                        <Clock className="size-3 shrink-0" />
                        {next.time} · {next.name} ({next.partySize})
                      </p>
                    )}
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Today's arrivals in time order — the host's running order of service. */
function UpcomingStrip({ tables }: { tables: FloorTableState[] }) {
  const upcoming = tables
    .flatMap((t) =>
      t.bookings
        .filter((b) => b.status === "confirmed" || b.status === "seated")
        .map((b) => ({ ...b, table: t.table })),
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  if (upcoming.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
        No bookings for today at this branch.
      </p>
    );
  }

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold tracking-[0.18em] text-white/40 uppercase">
        Arriving today
      </h2>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {upcoming.map((b) => (
          <div
            key={b.id}
            className="w-44 shrink-0 rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <p className="font-display text-lg leading-none text-white">
              {b.time}
            </p>
            <p className="mt-1 truncate text-sm text-white/85">{b.name}</p>
            <p className="text-xs text-white/50">
              {b.partySize} guests · {b.table.label ?? `Table ${b.table.number}`}
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/35">
              {b.reference}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
