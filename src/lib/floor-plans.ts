/**
 * Room fixtures for each branch's floor plan.
 *
 * These are presentation only — the kitchen pass, the bar, the entrance, the
 * planters. They give the plan enough context to read as a room instead of
 * shapes floating in a box, which is what a host needs to orient themselves.
 *
 * Deliberately not in the database: unlike tables, fixtures carry no state and
 * nobody books them. Keeping them here avoids a migration for what is really a
 * drawing.
 *
 * Coordinates match the table grid — x/y are the centre as a percentage of
 * each axis, w/h the size. `aspect` is the room's real width:height, so a
 * narrow shophouse renders tall and a lakeside room renders wide.
 */

export type FloorFeature = {
  kind:
    | "kitchen"
    | "bar"
    | "entrance"
    | "planter"
    | "service"
    | "window"
    | "water"
    | "divider";
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FloorPlan = {
  /** Room width ÷ height. Tables keep their own proportions regardless. */
  aspect: number;
  features: FloorFeature[];
};

export const FLOOR_PLANS: Record<string, FloorPlan> = {
  /* ---------------------------------------------------------------------- */
  /*  Bangsar — a Telawi shophouse: narrow frontage, deep room               */
  /* ---------------------------------------------------------------------- */
  bangsar: {
    aspect: 0.8,
    features: [
      {
        kind: "kitchen",
        label: "Wood-fired oven & pass",
        x: 50,
        y: 6,
        w: 74,
        h: 9,
      },
      { kind: "window", label: "Street windows", x: 4, y: 54, w: 4, h: 62 },
      { kind: "bar", label: "Bar", x: 92, y: 16, w: 9, h: 20 },
      { kind: "service", label: "Station", x: 92, y: 96, w: 9, h: 7 },
      { kind: "entrance", label: "Jalan Telawi 3", x: 45, y: 96, w: 30, h: 6 },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*  Setapak — a wide neighbourhood hall built around family tables         */
  /* ---------------------------------------------------------------------- */
  setapak: {
    aspect: 1.5,
    features: [
      { kind: "kitchen", label: "Kitchen", x: 24, y: 5, w: 34, h: 9 },
      { kind: "service", label: "Station", x: 62, y: 5, w: 12, h: 9 },
      { kind: "entrance", label: "Entrance", x: 4, y: 40, w: 6, h: 22 },
      {
        kind: "planter",
        label: "Garden terrace",
        x: 50,
        y: 94,
        w: 92,
        h: 10,
      },
      { kind: "divider", x: 50, y: 69, w: 92, h: 1.2 },
      { kind: "bar", label: "Drinks", x: 95, y: 5, w: 8, h: 9 },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*  Bukit Jelutong — half the room is a deck under the rain trees          */
  /* ---------------------------------------------------------------------- */
  "bukit-jelutong": {
    aspect: 1.5,
    features: [
      { kind: "divider", x: 51, y: 50, w: 1.2, h: 92 },
      { kind: "planter", label: "Rain trees", x: 6, y: 30, w: 8, h: 34 },
      { kind: "planter", x: 6, y: 72, w: 8, h: 26 },
      { kind: "planter", label: "Pergola", x: 70, y: 96, w: 40, h: 6 },
      { kind: "kitchen", label: "Kitchen", x: 78, y: 5, w: 36, h: 8 },
      { kind: "bar", label: "Bar", x: 57, y: 20, w: 8, h: 22 },
      { kind: "entrance", label: "Entrance", x: 96, y: 70, w: 6, h: 20 },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*  Putrajaya — windows run the length of the lake                         */
  /* ---------------------------------------------------------------------- */
  putrajaya: {
    aspect: 1.6,
    features: [
      { kind: "water", label: "Putrajaya Lake", x: 50, y: 3, w: 100, h: 7 },
      { kind: "window", label: "Lake-view windows", x: 50, y: 8, w: 96, h: 2 },
      { kind: "bar", label: "Reception & bar", x: 5, y: 45, w: 8, h: 26 },
      { kind: "kitchen", label: "Kitchen", x: 96, y: 74, w: 7, h: 32 },
      { kind: "entrance", label: "Jalan Alamanda", x: 5, y: 88, w: 8, h: 18 },
      { kind: "divider", x: 50, y: 58, w: 90, h: 1.2 },
    ],
  },
};

export function floorPlanFor(slug: string): FloorPlan {
  return FLOOR_PLANS[slug] ?? { aspect: 1.4, features: [] };
}

/** Tailwind classes per fixture kind — muted so tables stay the focus. */
export const FEATURE_STYLES: Record<
  FloorFeature["kind"],
  { box: string; text: string }
> = {
  kitchen: {
    box: "bg-stone-300/50 border border-stone-400/60",
    text: "text-stone-700",
  },
  bar: {
    box: "bg-amber-200/40 border border-amber-400/50",
    text: "text-amber-900",
  },
  entrance: {
    box: "bg-brand-100/60 border border-dashed border-brand-400/70",
    text: "text-brand-800",
  },
  planter: {
    box: "bg-emerald-200/40 border border-emerald-400/40",
    text: "text-emerald-800",
  },
  service: {
    box: "bg-stone-200/60 border border-stone-300",
    text: "text-stone-600",
  },
  window: { box: "bg-sky-200/50 border border-sky-300/60", text: "text-sky-800" },
  water: { box: "bg-sky-300/45 border border-sky-400/40", text: "text-sky-900" },
  divider: { box: "bg-stone-400/25", text: "text-transparent" },
};
