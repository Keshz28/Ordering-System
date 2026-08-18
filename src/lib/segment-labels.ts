import type { Segment } from "@/db/schema";

/**
 * Presentation constants for CRM segments. Kept free of database imports so
 * client components can render segment chips without bundling libSQL.
 */

export const SEGMENTS = [
  "new",
  "repeat",
  "vip",
  "at_risk",
  "dormant",
] as const;

export const SEGMENT_LABELS: Record<Segment, string> = {
  new: "New",
  repeat: "Repeat",
  vip: "VIP",
  at_risk: "At risk",
  dormant: "Dormant",
};

export const SEGMENT_DESCRIPTIONS: Record<Segment, string> = {
  new: "Exactly one order placed",
  repeat: "2–5 orders",
  vip: "Spent over RM1,500 or 10+ orders",
  at_risk: "Silent for 45–90 days",
  dormant: "Silent for more than 90 days",
};

export const SEGMENT_STYLES: Record<Segment, string> = {
  new: "bg-sky-100 text-sky-800 border-sky-200",
  repeat: "bg-emerald-100 text-emerald-800 border-emerald-200",
  vip: "bg-amber-100 text-amber-900 border-amber-200",
  at_risk: "bg-orange-100 text-orange-800 border-orange-200",
  dormant: "bg-stone-200 text-stone-700 border-stone-300",
};
