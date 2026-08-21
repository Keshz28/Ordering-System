"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Lock } from "lucide-react";
import type { Branch } from "@/db/schema";
import { cn } from "@/lib/utils";

/**
 * Switches the outlet a staff member is looking at.
 *
 * Accounts tied to a branch see a locked badge instead of a control — the
 * server refuses the switch either way, this just avoids offering something
 * that would be rejected.
 */
export function BranchSwitcher({
  branches,
  currentSlug,
  locked,
  className,
}: {
  branches: Branch[];
  currentSlug: string | null;
  locked: boolean;
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

  const current = branches.find((b) => b.slug === currentSlug) ?? null;
  const label = current ? current.shortName : "All branches";

  async function choose(slug: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/staff/branch", {
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

  if (locked) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-cream-500 bg-cream-200 px-3 py-1.5 text-sm font-medium text-ink-700",
          className,
        )}
        title="Your account is assigned to this branch"
      >
        <Lock className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex w-full items-center gap-1.5 rounded-full border border-cream-500 bg-white px-3 py-1.5 text-sm font-medium text-ink-900 transition hover:border-brand-400 disabled:opacity-60"
      >
        <Building2 className="size-3.5 shrink-0 text-brand-700" />
        <span className="truncate">{label}</span>
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 shrink-0 text-ink-500 transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1.5 max-h-72 w-56 overflow-auto rounded-xl border border-cream-400 bg-white p-1 shadow-[var(--shadow-lift)]"
        >
          <Option
            label="All branches"
            hint="Group-wide totals"
            active={!currentSlug}
            onSelect={() => choose("all")}
          />
          {branches.map((b) => (
            <Option
              key={b.id}
              label={b.shortName}
              hint={b.city}
              active={b.slug === currentSlug}
              onSelect={() => choose(b.slug)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Option({
  label,
  hint,
  active,
  onSelect,
}: {
  label: string;
  hint: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={active}
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
          active ? "bg-brand-50 text-brand-800" : "text-ink-700 hover:bg-cream-200",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{label}</span>
          <span className="block truncate text-xs text-ink-500">{hint}</span>
        </span>
        {active && <Check className="size-4 shrink-0" strokeWidth={3} />}
      </button>
    </li>
  );
}
