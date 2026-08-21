"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import type { Branch } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Slot = { time: string; label: string; availableTables: number; isPast: boolean };
type TableOption = {
  table: {
    id: number;
    number: number;
    label: string | null;
    seats: number;
    zone: string;
  };
  available: boolean;
  reason: string;
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

/**
 * Taking a booking at the host stand or over the phone.
 *
 * Optimised for speed rather than browsing: the guest is looked up by email as
 * it's typed so a regular's details fill themselves in, past slots stay
 * selectable for walk-ins, and tables are chips rather than a floor map
 * because the host usually has a phone against their ear.
 */
export function NewReservationDialog({
  branches,
  defaultBranchId,
  defaultDate,
  branchLocked,
}: {
  branches: Branch[];
  defaultBranchId: number;
  defaultDate: string;
  branchLocked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [branchId, setBranchId] = React.useState(defaultBranchId);
  const [date, setDate] = React.useState(defaultDate);
  const [partySize, setPartySize] = React.useState(2);
  const [time, setTime] = React.useState<string | null>(null);
  const [tableId, setTableId] = React.useState<number | null>(null);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [occasion, setOccasion] = React.useState("none");
  const [notes, setNotes] = React.useState("");
  const [matched, setMatched] = React.useState<string | null>(null);

  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [tables, setTables] = React.useState<TableOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  const today = React.useMemo(() => dateKey(new Date()), []);

  function resetSlotSelection() {
    setTime(null);
    setTableId(null);
    setTables([]);
    setLoading(true);
  }

  // Slots for the chosen branch / day / party.
  React.useEffect(() => {
    if (!open || !branchId) return;
    let cancelled = false;
    fetch(
      `/api/reservations/availability?branchId=${branchId}&date=${date}&partySize=${partySize}`,
    )
      .then((r) => r.json())
      .then((d) => !cancelled && setSlots(d.slots ?? []))
      .catch(() => !cancelled && toast.error("Couldn't load availability."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, branchId, date, partySize]);

  // Tables once a time is picked.
  React.useEffect(() => {
    if (!open || !branchId || !time) return;
    let cancelled = false;
    fetch(
      `/api/reservations/availability?branchId=${branchId}&date=${date}&partySize=${partySize}&time=${time}`,
    )
      .then((r) => r.json())
      .then((d) => !cancelled && setTables(d.tables ?? []))
      .catch(() => !cancelled && toast.error("Couldn't load tables."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, branchId, date, partySize, time]);

  // Look the guest up by email so regulars don't get retyped.
  React.useEffect(() => {
    const value = email.trim().toLowerCase();
    if (!open || !value.includes("@")) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/admin/customers?email=${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const found = d.customer;
          if (found) {
            setMatched(found.name);
            setName((n) => n || found.name);
            setPhone((p) => p || found.phone || "");
          } else {
            setMatched(null);
          }
        })
        .catch(() => {});
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [email, open]);

  const available = tables.filter((t) => t.available);
  const chosenTable = tables.find((t) => t.table.id === tableId) ?? null;
  const canSubmit = Boolean(time && tableId && name.trim() && email.includes("@"));

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          branchId,
          tableId,
          partySize,
          date,
          time,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          occasion,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save that booking.");
        if (res.status === 409 && time) {
          const refreshed = await fetch(
            `/api/reservations/availability?branchId=${branchId}&date=${date}&partySize=${partySize}&time=${time}`,
          ).then((r) => r.json());
          setTables(refreshed.tables ?? []);
          setTableId(null);
        }
        return;
      }
      toast.success(
        `${data.reservation.reference} booked${data.createdGuest ? " — new guest added to CRM" : ""}`,
      );
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setTime(null);
    setTableId(null);
    setTables([]);
    setName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setOccasion("none");
    setMatched(null);
    setPartySize(2);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus /> New booking
        </Button>
      </DialogTrigger>

      <DialogContent side="center" className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Take a booking</DialogTitle>
          <DialogDescription>
            For phone bookings and walk-ins. The guest is matched by email, or
            added to the CRM if they&apos;re new.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 pb-5">
          {/* When and where */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Branch" htmlFor="nr-branch">
              <NativeSelect
                id="nr-branch"
                value={branchId}
                disabled={branchLocked}
                onChange={(e) => {
                  setBranchId(Number(e.target.value));
                  resetSlotSelection();
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.shortName}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Date" htmlFor="nr-date">
              <Input
                id="nr-date"
                type="date"
                value={date}
                min={today}
                onChange={(e) => {
                  setDate(e.target.value);
                  resetSlotSelection();
                }}
              />
            </Field>
          </div>

          <Field label="Party size" htmlFor="nr-party">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="nr-party"
                type="number"
                min={1}
                max={30}
                value={partySize}
                onChange={(e) => {
                  setPartySize(Math.max(1, Number(e.target.value) || 1));
                  resetSlotSelection();
                }}
                className="w-24"
              />
              {[2, 4, 6, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setPartySize(n);
                    resetSlotSelection();
                  }}
                  className={cn(
                    "h-9 min-w-9 rounded-full border px-3 text-sm transition",
                    partySize === n
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-cream-500 bg-white text-ink-700 hover:border-brand-400",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>

          {/* Time */}
          <Field label="Time">
            {loading && slots.length === 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-9 w-16 rounded-full" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-ink-500">
                This branch isn&apos;t open on that date.
              </p>
            ) : (
              <div className="no-scrollbar flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {slots.map((s) => {
                  const full = s.availableTables === 0;
                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={full}
                      onClick={() => {
                        setTime(s.time);
                        setTableId(null);
                        setLoading(true);
                      }}
                      title={
                        full
                          ? "Fully booked"
                          : `${s.availableTables} table(s) free${s.isPast ? " · slot already started" : ""}`
                      }
                      className={cn(
                        "h-9 rounded-full border px-3 text-sm font-medium transition",
                        time === s.time
                          ? "border-brand-700 bg-brand-700 text-white"
                          : full
                            ? "cursor-not-allowed border-cream-400 bg-cream-200 text-ink-500/40 line-through"
                            : s.isPast
                              ? "border-cream-500 bg-cream-100 text-ink-500 hover:border-brand-400"
                              : "border-cream-500 bg-white text-ink-700 hover:border-brand-500",
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}
            {slots.some((s) => s.isPast) && (
              <p className="mt-1 text-xs text-ink-500">
                Greyed times have already started — still bookable for walk-ins.
              </p>
            )}
          </Field>

          {/* Table */}
          {time && (
            <Field
              label="Table"
              hint={
                available.length
                  ? `${available.length} free at ${slots.find((s) => s.time === time)?.label}`
                  : undefined
              }
            >
              {available.length === 0 ? (
                <p className="text-sm text-red-600">
                  No table fits {partySize} at that time. Try another slot.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {available.map(({ table, reason }) => (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setTableId(table.id)}
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition",
                        tableId === table.id
                          ? "border-brand-700 bg-brand-700 text-white"
                          : reason === "oversized"
                            ? "border-cream-500 bg-cream-100 text-ink-500 hover:border-brand-400"
                            : "border-cream-500 bg-white text-ink-700 hover:border-brand-500",
                      )}
                      title={`${table.zone}${reason === "oversized" ? " · larger than needed" : ""}`}
                    >
                      {tableId === table.id && (
                        <Check className="size-3.5" strokeWidth={3} />
                      )}
                      {table.label ?? table.number}
                      <span className="inline-flex items-center gap-0.5 opacity-60">
                        <Users className="size-3" />
                        {table.seats}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Field>
          )}

          {/* Guest */}
          <div className="rounded-xl border border-cream-400 bg-cream-100 p-3.5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">
              <Search className="size-3.5" /> Guest
            </p>
            <div className="flex flex-col gap-3">
              <Field
                label="Email"
                htmlFor="nr-email"
                hint={
                  matched
                    ? undefined
                    : "We match on email — an unknown one creates a CRM record."
                }
              >
                <Input
                  id="nr-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guest@example.com"
                />
              </Field>
              {matched && (
                <Badge variant="success" className="w-fit">
                  <Check className="size-3" /> Existing guest — {matched}
                </Badge>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" htmlFor="nr-name">
                  <Input
                    id="nr-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                  />
                </Field>
                <Field label="Phone" htmlFor="nr-phone">
                  <Input
                    id="nr-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+60 12-345 6789"
                    inputMode="tel"
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Occasion" htmlFor="nr-occasion">
              <NativeSelect
                id="nr-occasion"
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
            <Field label="Notes" htmlFor="nr-notes">
              <Textarea
                id="nr-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, high chair, quiet corner…"
              />
            </Field>
          </div>

          {chosenTable && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
              {partySize} guests · {chosenTable.table.label ?? `Table ${chosenTable.table.number}`}{" "}
              ({chosenTable.table.zone}) ·{" "}
              {slots.find((s) => s.time === time)?.label}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" /> Saving…
              </>
            ) : (
              "Confirm booking"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
