"use client";

import * as React from "react";
import { Check, Users } from "lucide-react";
import type { RestaurantTable } from "@/db/schema";
import { FloorCanvas, shapeClass, type PlanTable } from "@/components/floor/floor-canvas";
import { floorPlanFor } from "@/lib/floor-plans";
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
 * The booking floor plan. Draws the same room the staff see, with each table
 * as a real button so keyboard focus, screen readers and touch targets behave
 * without extra work.
 */
export function FloorMap({
  tables,
  selectedId,
  onSelect,
  partySize,
  branchSlug,
  className,
}: {
  tables: FloorTable[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  partySize: number;
  branchSlug: string;
  className?: string;
}) {
  const plan = floorPlanFor(branchSlug);
  const byId = React.useMemo(
    () => new Map(tables.map((t) => [t.table.id, t])),
    [tables],
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <FloorCanvas
        plan={plan}
        tables={tables.map((t) => t.table as PlanTable)}
        renderTable={(t) => {
          const entry = byId.get(t.id);
          if (!entry) return null;
          const { available, reason } = entry;
          const selected = selectedId === t.id;
          return (
            <button
              type="button"
              disabled={!available}
              onClick={() => onSelect(t.id)}
              aria-pressed={selected}
              aria-label={`Table ${t.number}${t.label ? ` (${t.label})` : ""}, seats ${t.seats}, ${labelFor(reason)}`}
              title={`${t.label ?? `Table ${t.number}`} · seats ${t.seats} · ${labelFor(reason)}`}
              className={cn(
                "flex size-full flex-col items-center justify-center border-2 transition-all",
                shapeClass(t.shape),
                selected
                  ? "z-20 scale-[1.06] border-brand-800 bg-brand-700 text-white shadow-lg"
                  : reason === "available"
                    ? "z-10 border-brand-300 bg-white text-ink-900 hover:border-brand-600 hover:bg-brand-50 hover:shadow-md"
                    : reason === "oversized"
                      ? "z-10 border-cream-500 bg-white/70 text-ink-500 hover:border-brand-400 hover:text-ink-900"
                      : "cursor-not-allowed border-cream-400 bg-cream-300/70 text-ink-500/45",
              )}
            >
              {selected ? (
                <Check className="size-3.5 sm:size-4" strokeWidth={3} />
              ) : (
                <span className="text-[9px] leading-none font-bold sm:text-xs">
                  {t.label ?? t.number}
                </span>
              )}
              <span className="mt-0.5 hidden items-center gap-0.5 text-[8px] leading-none opacity-70 sm:flex">
                <Users className="size-2.5" />
                {t.seats}
              </span>
            </button>
          );
        }}
      />
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
