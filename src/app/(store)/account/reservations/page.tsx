import Link from "next/link";
import {
  CalendarCheck,
  CalendarPlus,
  Clock,
  MapPin,
  StickyNote,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CancelReservation } from "@/components/store/cancel-reservation";
import { requireCustomer } from "@/lib/auth";
import { to12h } from "@/lib/branches";
import {
  OCCASION_LABELS,
  RESERVATION_STATUS_LABELS,
  partitionReservations,
  reservationsForCustomer,
} from "@/lib/reservations";
import { formatDate } from "@/lib/utils";
import type { ReservationStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<
  ReservationStatus,
  "success" | "info" | "neutral" | "danger" | "warning"
> = {
  confirmed: "success",
  seated: "info",
  completed: "neutral",
  cancelled: "danger",
  no_show: "warning",
};

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const customer = await requireCustomer("/account/reservations");
  const { new: justBooked } = await searchParams;
  const rows = await reservationsForCustomer(customer.id);

  const { upcoming, past } = partitionReservations(rows);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Your bookings</h1>
          <p className="text-sm text-ink-500">
            {upcoming.length > 0
              ? `${upcoming.length} table${upcoming.length === 1 ? "" : "s"} held for you.`
              : "No tables held right now."}
          </p>
        </div>
        <Button asChild>
          <Link href="/reserve">
            <CalendarPlus /> Book a table
          </Link>
        </Button>
      </div>

      {justBooked && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CalendarCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-medium text-emerald-900">
              Booking confirmed — {justBooked}
            </p>
            <p className="text-sm text-emerald-800">
              We&apos;ve put the details in your Inbox. Just show the reference
              when you arrive.
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-cream-200 text-brand-700">
            <CalendarCheck className="size-6" />
          </span>
          <div>
            <p className="font-medium text-ink-900">No bookings yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
              Pick your exact table from the floor plan at any of our four
              branches — the same way you&apos;d choose a seat at the cinema.
            </p>
          </div>
          <Button asChild className="mt-1">
            <Link href="/reserve">Find a table</Link>
          </Button>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">
                Upcoming
              </h2>
              {upcoming.map((r) => (
                <ReservationCard key={r.reservation.id} row={r} cancellable />
              ))}
            </section>
          )}

          {past.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">
                Past &amp; cancelled
              </h2>
              {past.map((r) => (
                <ReservationCard key={r.reservation.id} row={r} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

type Row = Awaited<ReturnType<typeof reservationsForCustomer>>[number];

function ReservationCard({
  row,
  cancellable,
}: {
  row: Row;
  cancellable?: boolean;
}) {
  const { reservation: r, table, branch } = row;
  const time = `${String(r.startsAt.getHours()).padStart(2, "0")}:${String(r.startsAt.getMinutes()).padStart(2, "0")}`;
  const when = `${formatDate(r.startsAt)} at ${to12h(time)}`;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-brand-800">
              {r.reference}
            </span>
            <Badge variant={STATUS_VARIANT[r.status]}>
              {RESERVATION_STATUS_LABELS[r.status]}
            </Badge>
            {r.occasion !== "none" && (
              <Badge variant="gold">{OCCASION_LABELS[r.occasion]}</Badge>
            )}
          </div>
          <p className="mt-2 font-display text-lg text-ink-900">{when}</p>
        </div>

        {cancellable && (
          <CancelReservation
            reservationId={r.id}
            reference={r.reference}
            when={when}
          />
        )}
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Detail icon={MapPin} label="Branch">
          {branch.name}
          <span className="block text-xs text-ink-500">{branch.address}</span>
        </Detail>
        <Detail icon={Users} label="Table">
          {table.label ?? `Table ${table.number}`} · {table.zone}
          <span className="block text-xs text-ink-500">
            {r.partySize} {r.partySize === 1 ? "guest" : "guests"} · seats{" "}
            {table.seats}
          </span>
        </Detail>
        <Detail icon={Clock} label="Held for">
          {r.durationMinutes} minutes
        </Detail>
        {r.notes && (
          <Detail icon={StickyNote} label="Your note">
            {r.notes}
          </Detail>
        )}
      </dl>
    </Card>
  );
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-700" />
      <div className="min-w-0">
        <dt className="text-xs tracking-wide text-ink-500 uppercase">{label}</dt>
        <dd className="text-ink-900">{children}</dd>
      </div>
    </div>
  );
}
