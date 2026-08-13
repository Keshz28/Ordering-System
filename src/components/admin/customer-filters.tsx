"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, NativeSelect } from "@/components/ui/input";

const SEGMENTS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "repeat", label: "Repeat" },
  { value: "vip", label: "VIP" },
  { value: "at_risk", label: "At risk" },
  { value: "dormant", label: "Dormant" },
] as const;

export function CustomerFilters({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(params.get("q") ?? "");

  const activeSegment = params.get("segment") ?? "all";
  const sort = params.get("sort") ?? "spend";

  const update = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
      }
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  // Debounce so typing doesn't fire a navigation per keystroke.
  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;
    const t = setTimeout(() => update({ q: query || null }), 350);
    return () => clearTimeout(t);
  }, [query, params, update]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or phone…"
          className="pl-10"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute top-1/2 right-3 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-500 hover:bg-cream-300"
            aria-label="Clear"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SEGMENTS.map((s) => (
          <button
            key={s.value}
            onClick={() => update({ segment: s.value })}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition",
              activeSegment === s.value
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-cream-400 bg-white text-ink-700 hover:border-brand-300",
            )}
          >
            {s.label}
            <span className="ml-1 opacity-60">{counts[s.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <NativeSelect
        value={sort}
        onChange={(e) => update({ sort: e.target.value })}
        className="w-44"
      >
        <option value="spend">Sort: total spent</option>
        <option value="recent">Sort: last order</option>
        <option value="orders">Sort: order count</option>
        <option value="points">Sort: points balance</option>
      </NativeSelect>
    </div>
  );
}
