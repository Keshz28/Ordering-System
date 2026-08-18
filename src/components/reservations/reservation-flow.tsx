"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  LogIn,
  MapPin,
  Minus,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { Branch, Customer, Settings } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FloorMap, type FloorTable } from "./floor-map";
import { cn } from "@/lib/utils";

type Slot = {
  time: string;
  label: string;
  availableTables: number;
  isPast: boolean;
};

const OCCASIONS = [
  { value: "none", label: "No special occasion" },
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "date", label: "Date night" },
  { value: "business", label: "Business meal" },
  { value: "celebration", label: "Celebration" },
];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(d: Date, today: Date) {
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-MY", { weekday: "short" });
}

export function ReservationFlow({
  branches,
  settings,
  customer,
  initialBranchId,
}: {
  branches: Branch[];
  settings: Settings;
  customer: Customer | null;
  initialBranchId?: number;
}) {
  const router = useRouter();
  const today = React.useMemo(() => new Date(), []);

  const [branchId, setBranchId] = React.useState<number>(
    initialBranchId ?? branches[0]?.id ?? 0,
  );
  const [partySize, setPartySize] = React.useState(2);
  const [date, setDate] = React.useState(dateKey(today));
  const [time, setTime] = React.useState<string | null>(null);
  const [tableId, setTableId] = React.useState<number | null>(null);
  const [occasion, setOccasion] = React.useState("none");
  const [notes, setNotes] = React.useState("");
  const [phone, setPhone] = React.useState(customer?.phone ?? "");

  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [tables, setTables] = React.useState<FloorTable[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [loadingTables, setLoadingTables] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const maxParty = settings.reservationMaxPartySize;
  const branch = branches.find((b) => b.id === branchId) ?? null;
  const tableChoice = tables.find((t) => t.table.id === tableId) ?? null;

  const days = React.useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      return { key: dateKey(d), date: d };
    });
  }, [today]);

  /**
   * Changing the branch, day or party invalidates the time and the table, so
   * those resets live in the handlers rather than in an effect — the effects
   * below only fetch and store results.
   */
  function resetSelection() {
    setTime(null);
    setTableId(null);
    setTables([]);
    setLoadingSlots(true);
  }

  function chooseBranch(id: number) {
    if (id === branchId) return;
    setBranchId(id);
    resetSelection();
  }

  function chooseDate(key: string) {
    if (key === date) return;
    setDate(key);
    resetSelection();
  }

  function chooseParty(n: number) {
    const next = Math.min(maxParty, Math.max(1, n));
    if (next === partySize) return;
    setPartySize(next);
    resetSelection();
  }

  function chooseTime(t: string) {
    setTime(t);
    setTableId(null);
    setLoadingTables(true);
  }

  // Slots for the chosen branch, day and party size.
  React.useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    fetch(
      `/api/reservations/availability?branchId=${branchId}&date=${date}&partySize=${partySize}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots ?? []);
        if (data.error) toast.error(data.error);
      })
      .catch(() => !cancelled && toast.error("Couldn't load availability."))
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, date, partySize]);

  // The room only loads once a time is chosen.
  React.useEffect(() => {
    if (!branchId || !time) return;
    let cancelled = false;
    fetch(
      `/api/reservations/availability?branchId=${branchId}&date=${date}&partySize=${partySize}&time=${time}`,
    )
      .then((r) => r.json())
      .then((data) => !cancelled && setTables(data.tables ?? []))
      .catch(() => !cancelled && toast.error("Couldn't load the floor plan."))
      .finally(() => !cancelled && setLoadingTables(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, date, partySize, time]);

  async function book() {
    if (!customer) {
      router.push(`/login?next=${encodeURIComponent("/reserve")}`);
      return;
    }
    if (!tableId || !time) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          branchId,
          tableId,
          partySize,
          date,
          time,
          occasion,
          notes: notes.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't complete the booking.");
        // Someone may have taken the table — refresh the room.
        if (res.status === 409 && time) {
          const refreshed = await fetch(
            `/api/reservations/availability?branchId=${branchId}&date=${date}&partySize=${partySize}&time=${time}`,
          ).then((r) => r.json());
          setTables(refreshed.tables ?? []);
          setTableId(null);
        }
        return;
      }
      toast.success(`Table booked — ${data.reservation.reference}`);
      router.push(`/account/reservations?new=${data.reservation.reference}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
      {/* ------------------------------ controls ----------------------------- */}
      <div className="flex flex-col gap-5">
        {/* Branch */}
        <section>
          <SectionTitle step={1} icon={MapPin} title="Choose a branch" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {branches.map((b) => {
              const active = b.id === branchId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => chooseBranch(b.id)}
                  className={cn(
                    "rounded-xl border-2 p-3.5 text-left transition",
                    active
                      ? "border-brand-700 bg-brand-50 shadow-sm"
                      : "border-cream-400 bg-white hover:border-brand-300",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink-900">
                        {b.shortName}
                      </p>
                      <p className="truncate text-xs text-ink-500">{b.city}</p>
                    </div>
                    {active && (
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-ink-500">
                    {b.blurb}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Party size */}
        <section>
          <SectionTitle step={2} icon={Users} title="How many people?" />
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-full border border-cream-500 bg-white p-1">
              <Button
                variant="ghost"
                size="iconSm"
                aria-label="Fewer guests"
                disabled={partySize <= 1}
                onClick={() => chooseParty(partySize - 1)}
              >
                <Minus />
              </Button>
              <span className="w-12 text-center text-lg font-semibold tabular-nums">
                {partySize}
              </span>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label="More guests"
                disabled={partySize >= maxParty}
                onClick={() => chooseParty(partySize + 1)}
              >
                <Plus />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[2, 4, 6, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => chooseParty(n)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition",
                    partySize === n
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-cream-500 bg-white text-ink-700 hover:border-brand-400",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {partySize >= maxParty && (
            <p className="mt-2 text-xs text-ink-500">
              Parties over {maxParty} are arranged by phone — call{" "}
              {branch?.phone ?? "the branch"}.
            </p>
          )}
        </section>

        {/* Date */}
        <section>
          <SectionTitle step={3} icon={CalendarDays} title="Pick a date" />
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {days.map(({ key, date: d }) => {
              const active = key === date;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => chooseDate(key)}
                  className={cn(
                    "flex w-16 shrink-0 flex-col items-center rounded-xl border-2 px-2 py-2 transition",
                    active
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-cream-400 bg-white text-ink-700 hover:border-brand-300",
                  )}
                >
                  <span className="text-[10px] font-medium tracking-wide uppercase opacity-80">
                    {dayLabel(d, today)}
                  </span>
                  <span className="text-lg leading-tight font-bold">
                    {d.getDate()}
                  </span>
                  <span className="text-[10px] opacity-80">
                    {d.toLocaleDateString("en-MY", { month: "short" })}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Time */}
        <section>
          <SectionTitle step={4} icon={Clock} title="Choose a time" />
          {loadingSlots ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton h-9 w-20 rounded-full" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="rounded-xl border border-cream-400 bg-white p-4 text-sm text-ink-500">
              {branch?.shortName} isn&apos;t open for bookings on this date. Try
              another day.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => {
                const disabled = s.isPast || s.availableTables === 0;
                const active = time === s.time;
                return (
                  <button
                    key={s.time}
                    type="button"
                    disabled={disabled}
                    onClick={() => chooseTime(s.time)}
                    className={cn(
                      "relative rounded-full border px-3.5 py-2 text-sm font-medium transition",
                      active
                        ? "border-brand-700 bg-brand-700 text-white"
                        : disabled
                          ? "cursor-not-allowed border-cream-400 bg-cream-200 text-ink-500/40 line-through"
                          : "border-cream-500 bg-white text-ink-700 hover:border-brand-500 hover:bg-brand-50",
                    )}
                    title={
                      disabled
                        ? s.isPast
                          ? "This time has passed"
                          : "Fully booked"
                        : `${s.availableTables} table${s.availableTables === 1 ? "" : "s"} free`
                    }
                  >
                    {s.label}
                    {!disabled && s.availableTables <= 2 && (
                      <span
                        className={cn(
                          "ml-1.5 text-[10px] font-semibold",
                          active ? "text-white/80" : "text-brand-700",
                        )}
                      >
                        {s.availableTables} left
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Floor map */}
        {time && (
          <section>
            <SectionTitle step={5} icon={MapPin} title="Pick your table" />
            {branch?.floorPlanNote && (
              <p className="mb-3 text-sm text-ink-500">{branch.floorPlanNote}</p>
            )}
            {loadingTables ? (
              <div className="skeleton aspect-square w-full rounded-2xl" />
            ) : (
              <FloorMap
                tables={tables}
                selectedId={tableId}
                onSelect={setTableId}
                partySize={partySize}
              />
            )}
          </section>
        )}
      </div>

      {/* ------------------------------ summary ------------------------------ */}
      <Card className="lg:sticky lg:top-24">
        <div className="border-b border-cream-400 p-5">
          <h2 className="font-display text-lg text-ink-900">Your booking</h2>
          <p className="text-sm text-ink-500">
            Held for {settings.reservationDurationMinutes} minutes from your
            arrival time.
          </p>
        </div>

        <dl className="divide-y divide-cream-300 px-5 text-sm">
          <Row label="Branch" value={branch?.name ?? "—"} />
          <Row label="Guests" value={`${partySize}`} />
          <Row
            label="Date"
            value={new Date(`${date}T00:00:00`).toLocaleDateString("en-MY", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          />
          <Row
            label="Time"
            value={time ? (slots.find((s) => s.time === time)?.label ?? time) : "—"}
          />
          <Row
            label="Table"
            value={
              tableChoice
                ? `${tableChoice.table.label ?? `Table ${tableChoice.table.number}`} · ${tableChoice.table.zone} · seats ${tableChoice.table.seats}`
                : "—"
            }
          />
        </dl>

        <div className="flex flex-col gap-4 p-5">
          {customer ? (
            <>
              <div className="rounded-xl border border-cream-400 bg-cream-100 p-3.5">
                <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                  Booking under
                </p>
                <p className="mt-1 font-medium text-ink-900">{customer.name}</p>
                <p className="text-sm text-ink-500">{customer.email}</p>
              </div>

              <Field label="Contact number" htmlFor="res-phone">
                <Input
                  id="res-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+60 12-345 6789"
                  inputMode="tel"
                />
              </Field>

              <Field label="Occasion" htmlFor="res-occasion">
                <NativeSelect
                  id="res-occasion"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                >
                  {OCCASIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              <Field
                label="Anything we should know?"
                htmlFor="res-notes"
                hint="Allergies, access needs, a high chair — anything at all."
              >
                <Textarea
                  id="res-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={400}
                  placeholder="Optional"
                />
              </Field>

              <Button
                size="lg"
                className="w-full"
                disabled={!tableId || !time || submitting}
                onClick={book}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Booking…
                  </>
                ) : (
                  <>
                    Confirm booking <ChevronRight />
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-center">
              <LogIn className="mx-auto size-6 text-brand-700" />
              <p className="mt-2 font-medium text-ink-900">
                Sign in to hold your table
              </p>
              <p className="mt-1 text-sm text-ink-500">
                We only need your email — no password. It lets us hold the table
                in your name and send the confirmation.
              </p>
              <Button asChild className="mt-3 w-full">
                <a href={`/login?next=${encodeURIComponent("/reserve")}`}>
                  Sign in or create an account
                </a>
              </Button>
            </div>
          )}

          {!tableId && time && customer && (
            <p className="text-center text-xs text-ink-500">
              Pick a table on the floor plan to continue.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({
  step,
  title,
  icon: Icon,
}: {
  step: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Badge variant="neutral" className="size-6 justify-center p-0 tabular-nums">
        {step}
      </Badge>
      <Icon className="size-4 text-brand-700" />
      <h2 className="font-display text-lg text-ink-900">{title}</h2>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{value}</dd>
    </div>
  );
}
