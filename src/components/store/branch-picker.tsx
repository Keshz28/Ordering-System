"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, MapPin } from "lucide-react";
import type { Branch } from "@/db/schema";
import { cn } from "@/lib/utils";

/**
 * Which outlet the customer is ordering from.
 *
 * Sits in the storefront header because the branch decides delivery fee, ETA
 * and what's actually available tonight — a choice that shouldn't be buried
 * until checkout.
 */
export function BranchPicker({
  branches,
  currentSlug,
  openLabel,
  className,
}: {
  branches: Branch[];
  currentSlug: string | null;
  /** e.g. "Open until 10:30 pm", computed on the server. */
  openLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = branches.find((b) => b.slug === currentSlug) ?? branches[0];

  async function choose(slug: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/branch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branch: slug }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!current) return null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-full border border-cream-500 bg-white px-2.5 py-1.5 text-left transition hover:border-brand-400 disabled:opacity-60 sm:px-3"
      >
        <MapPin className="size-3.5 shrink-0 text-brand-700" />
        <span className="min-w-0">
          <span className="block truncate text-xs leading-tight font-medium text-ink-900">
            {current.shortName}
          </span>
          {openLabel && (
            <span className="hidden text-[10px] leading-tight text-ink-500 sm:block">
              {openLabel}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-ink-500 transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-cream-400 bg-white p-1 shadow-[var(--shadow-lift)]"
        >
          {branches.map((b) => {
            const active = b.slug === current.slug;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => choose(b.slug)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition",
                    active
                      ? "bg-brand-50 text-brand-800"
                      : "text-ink-700 hover:bg-cream-200",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {b.shortName}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {b.address}
                    </span>
                  </span>
                  {active && (
                    <Check className="mt-0.5 size-4 shrink-0" strokeWidth={3} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
