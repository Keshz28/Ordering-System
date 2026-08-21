"use client";

import * as React from "react";
import { FEATURE_STYLES, type FloorPlan } from "@/lib/floor-plans";
import type { RestaurantTable, TableShape } from "@/db/schema";
import { cn } from "@/lib/utils";

export type PlanTable = Pick<
  RestaurantTable,
  "id" | "number" | "label" | "seats" | "zone" | "shape" | "x" | "y" | "w" | "h"
>;

/**
 * The room, drawn once and shared by the booking picker and the staff floor
 * plan so both show the same restaurant.
 *
 * Two things make the geometry hold up everywhere:
 *
 * 1. w and h are percentages of their own axis, matching how the layout is
 *    authored and how scripts/check-floor-plans.mjs validates spacing. Sizing
 *    height from aspect-ratio instead ties it to the plan's *width*, which on
 *    a wide room makes every table ~1.5x too tall and pushes them into each
 *    other. Roundness is handled by choosing h relative to the room's aspect
 *    in branch-data.ts.
 *
 * 2. The plan has a minimum pixel width and pans horizontally below it, rather
 *    than shrinking to fit. Clamping individual tables to a tappable size was
 *    the obvious alternative, but on a 343px-wide phone the wide rooms are only
 *    ~229px tall, so the clamp inflated tables until they overlapped each
 *    other. Panning a map is the normal gesture and keeps the room truthful.
 */
export function FloorCanvas({
  plan,
  tables,
  renderTable,
  className,
  /** Below this width the plan scrolls instead of shrinking. */
  minPlanWidth = 500,
}: {
  plan: FloorPlan;
  tables: PlanTable[];
  renderTable: (table: PlanTable) => React.ReactNode;
  className?: string;
  minPlanWidth?: number;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-cream-400 bg-[linear-gradient(180deg,#fdfbf7,#f6ede0)] shadow-inner",
          className,
        )}
        style={{ aspectRatio: plan.aspect, minWidth: `${minPlanWidth}px` }}
      >
        {/* Fixtures sit under the tables and never receive pointer events. */}
        {plan.features.map((f, i) => {
          const style = FEATURE_STYLES[f.kind];
          return (
            <div
              key={`${f.kind}-${i}`}
              aria-hidden
              className={cn(
                "pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md",
                style.box,
              )}
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: `${f.w}%`,
                height: `${f.h}%`,
              }}
            >
              {f.label && (
                <span
                  className={cn(
                    "px-1 text-center text-[8px] leading-tight font-semibold tracking-wide uppercase sm:text-[9px]",
                    style.text,
                  )}
                >
                  {f.label}
                </span>
              )}
            </div>
          );
        })}

        {tables.map((t) => (
          <div
            key={t.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: `${t.w}%`,
              height: `${t.h}%`,
            }}
          >
            {renderTable(t)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shape classes shared by both surfaces. */
export function shapeClass(shape: TableShape) {
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
