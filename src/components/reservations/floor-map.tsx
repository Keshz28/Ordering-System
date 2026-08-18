"use client";

import * as React from "react";
import { Check, Users } from "lucide-react";
import type { RestaurantTable, TableShape } from "@/db/schema";
import { cn } from "@/lib/utils";

export type FloorTable = {
  table: Pick<
    RestaurantTable,
    "id" | "number" | "label" | "seats" | "zone" | "shape" | "x" | "y" | "w" | "h"
  >;
  available: boolean;
  reason: "available" | "booked" | "too_small" | "oversized" | "not_bookable";
};

/**
 * The booking floor plan.
 *
 * Rendered in a square box because table coordinates are percentages of each
 * axis — a square keeps a 12×10 table looking like a table rather than a
 * letterbox, and it scales from a phone to a desktop without a second layout.
 *
 * Tables are real buttons rather than SVG shapes so keyboard focus, screen
 * readers and touch targets all behave without extra work.
 */
export function FloorMap({
  tables,
  selectedId,
  onSelect,
  partySize,
  className,
}: {
  tables: FloorTable[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  partySize: number;
  className?: string;
}) {
  const zones = React.useMemo(() => {
    const set = new Map<string, { x: number; y: number; count: number }>();
    for (const t of tables) {
      const z = set.get(t.table.zone) ?? { x: 0, y: 0, count: 0 };
      z.x += t.table.x;
      z.y += t.table.y;
      z.count += 1;
      set.set(t.table.zone, z);
    }
    return [...set.entries()].map(([name, z]) => ({
      name,
      x: z.x / z.count,
      y: z.y / z.count,
    }));
  }, [tables]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-cream-400 bg-[linear-gradient(180deg,#fdfbf7,#f8f0e4)] shadow-inner">
        {/* Faint zone names sit behind the tables for orientation. */}
        {zones.map((z) => (
          <span
            key={z.name}
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[8px] font-semibold tracking-[0.18em] whitespace-nowrap text-ink-500/25 uppercase sm:text-[10px]"
            style={{ left: `${z.x}%`, top: `${Math.max(3, z.y - 13)}%` }}
          >
            {z.name}
          </span>
        ))}

        {tables.map(({ table, available, reason }) => {
          const selected = selectedId === table.id;
          const disabled = !available;
          return (
            <button
              key={table.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(table.id)}
              aria-pressed={selected}
              aria-label={`Table ${table.number}${table.label ? ` (${table.label})` : ""}, seats ${table.seats}, ${labelFor(reason)}`}
              title={`${table.label ?? `Table ${table.number}`} · seats ${table.seats} · ${labelFor(reason)}`}
              className={cn(
                "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border-2 transition-all",
                shapeClass(table.shape),
                selected
                  ? "z-20 scale-[1.08] border-brand-800 bg-brand-700 text-white shadow-lg"
                  : reason === "available"
                    ? "z-10 border-brand-300 bg-white text-ink-900 hover:border-brand-600 hover:bg-brand-50 hover:shadow-md"
                    : reason === "oversized"
                      ? "z-10 border-cream-500 bg-white/70 text-ink-500 hover:border-brand-400 hover:text-ink-900"
                      : "cursor-not-allowed border-cream-400 bg-cream-300/70 text-ink-500/45",
              )}
              /**
               * Percentages size the table to the room, but on a phone the map
               * is ~343px wide and the smallest tables would land at 38×27px —
               * too small to tap confidently. The floors keep their proportions
               * on larger screens and stop shrinking past a usable target.
               * Growth is symmetric because the shape is centred on its point.
               */
              style={{
                left: `${table.x}%`,
                top: `${table.y}%`,
                width: `${table.w}%`,
                height: `${table.h}%`,
                minWidth: "2.75rem",
                minHeight: "2.25rem",
              }}
            >
              {selected ? (
                <Check className="size-3 sm:size-4" strokeWidth={3} />
              ) : (
                <span className="text-[9px] leading-none font-bold sm:text-xs">
                  {table.label ?? table.number}
                </span>
              )}
              <span className="mt-0.5 hidden items-center gap-0.5 text-[8px] leading-none opacity-70 sm:flex">
                <Users className="size-2.5" />
                {table.seats}
              </span>
            </button>
          );
        })}
      </div>

      <Legend partySize={partySize} />
    </div>
  );
}

function Legend({ partySize }: { partySize: number }) {
  const items = [
    { className: "border-brand-300 bg-white", label: "Available" },
    { className: "border-brand-800 bg-brand-700", label: "Your pick" },
    { className: "border-cream-500 bg-white/70", label: "Bigger than you need" },
    { className: "border-cream-400 bg-cream-300", label: "Taken" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-500">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded border-2", i.className)} />
          {i.label}
        </span>
      ))}
      <span className="ml-auto hidden sm:inline">
        Showing tables that seat {partySize}
        {partySize === 1 ? " person" : " people"} or more
      </span>
    </div>
  );
}

function shapeClass(shape: TableShape) {
  switch (shape) {
    case "round":
      return "rounded-full";
    case "booth":
      return "rounded-2xl rounded-l-sm";
    case "rect":
      return "rounded-xl";
    case "counter":
      return "rounded-md";
    default:
      return "rounded-lg";
  }
}

function labelFor(reason: FloorTable["reason"]) {
  switch (reason) {
    case "available":
      return "available";
    case "oversized":
      return "available, larger than you need";
    case "booked":
      return "already booked";
    case "too_small":
      return "too small for your party";
    default:
      return "not bookable";
  }
}
