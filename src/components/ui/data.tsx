import * as React from "react";
import { cn } from "@/lib/utils";

/* ----------------------------------- Table -------------------------------- */

export function DataTable({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-card border border-cream-400 bg-white shadow-[var(--shadow-card)]">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function Thead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-cream-400 bg-cream-200/70", className)}
      {...props}
    />
  );
}

export function Th({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function Tbody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-cream-300", className)} {...props} />
  );
}

export function Tr({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("transition hover:bg-cream-100", className)} {...props} />
  );
}

export function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 align-middle text-ink-700", className)} {...props} />
  );
}

/* -------------------------------- Empty state ----------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-cream-500 bg-cream-100/60 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="grid size-12 place-items-center rounded-full bg-cream-300 text-brand-700">
          <Icon className="size-6" />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium text-ink-900">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-ink-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- Skeletons ------------------------------- */

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-card border border-cream-400 bg-white p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-40" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-card border border-cream-400 bg-white p-4"
        >
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- Stat ---------------------------------- */

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "brand" | "success" | "warning";
}) {
  const tones = {
    default: "bg-cream-200 text-ink-700",
    brand: "bg-brand-50 text-brand-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
          {label}
        </p>
        {Icon ? (
          <span className={cn("grid size-9 place-items-center rounded-xl", tones[tone])}>
            <Icon className="size-4.5" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-3xl leading-none text-ink-900">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-xs text-ink-500">{sub}</p> : null}
    </div>
  );
}

/* ------------------------------ Page scaffolding -------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="font-display text-2xl leading-tight text-ink-900 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
