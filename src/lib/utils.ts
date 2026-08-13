import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Every price in the app renders through here, so formatting never drifts. */
export function money(amount: number | null | undefined, symbol = "$") {
  const n = Number.isFinite(amount as number) ? (amount as number) : 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}${symbol}${Math.abs(n).toFixed(2)}`;
}

/** SQLite reals accumulate float dust; round on every money computation. */
export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDate(d: Date | number | null | undefined) {
  if (!d) return "—";
  return dateFmt.format(typeof d === "number" ? new Date(d) : d);
}

export function formatTime(d: Date | number | null | undefined) {
  if (!d) return "—";
  return timeFmt.format(typeof d === "number" ? new Date(d) : d);
}

export function formatDateTime(d: Date | number | null | undefined) {
  if (!d) return "—";
  return `${formatDate(d)}, ${formatTime(d)}`;
}

export function relativeTime(d: Date | number | null | undefined) {
  if (!d) return "—";
  const then = typeof d === "number" ? d : d.getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(then);
}

export function daysBetween(a: Date | number, b: Date | number = Date.now()) {
  const aa = typeof a === "number" ? a : a.getTime();
  const bb = typeof b === "number" ? b : b.getTime();
  return Math.floor((bb - aa) / 86_400_000);
}

/** "HH:MM" -> minutes since midnight. */
export function minutesOfDay(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isWithinTimeWindow(
  from: string | null,
  to: string | null,
  now = new Date(),
) {
  if (!from || !to) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = minutesOfDay(from);
  const end = minutesOfDay(to);
  return start <= end
    ? cur >= start && cur <= end
    : cur >= start || cur <= end; // window crossing midnight
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Deterministic pseudo-random generator so seeded demo data is reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], headers?: string[]) {
  if (rows.length === 0) return (headers ?? []).join(",");
  const cols = headers ?? Object.keys(rows[0]);
  const lines = [cols.join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => csvEscape(row[c])).join(","));
  }
  return lines.join("\n");
}
