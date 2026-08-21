import Link from "next/link";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { CalendarCheck, CalendarX, Users } from "lucide-react";
import { db } from "@/db";
import { branch, customer, reservation, restaurantTable } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { staffScope, to12h } from "@/lib/branches";
import { OCCASION_LABELS, RESERVATION_STATUS_LABELS } from "@/lib/reservations";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReservationActions } from "@/components/admin/reservation-actions";
import { NewReservationDialog } from "@/components/admin/new-reservation-dialog";
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

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireStaff("admin");
  const scope = await staffScope(session);
  const { date } = await searchParams;

  const today = new Date();
  const selectedKey = date ?? dateKey(today);

  const branchFilter = scope.branchId
    ? eq(reservation.branchId, scope.branchId)
    : undefined;

  const rows = await db
    .select({ reservation, table: restaurantTable, branch, customer })
    .from(reservation)
    .innerJoin(restaurantTable, eq(reservation.tableId, restaurantTable.id))
    .innerJoin(branch, eq(reservation.branchId, branch.id))
    .innerJoin(customer, eq(reservation.customerId, customer.id))
    .where(and(eq(reservation.date, selectedKey), branchFilter))
    .orderBy(reservation.startsAt);

  // A week of counts for the date strip.
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekEnd = new Date(weekStart.getTime() + 13 * 86_400_000);
  const week = await db
    .select({ date: reservation.date, partySize: reservation.partySize })
    .from(reservation)
    .where(
      and(
        gte(reservation.date, dateKey(weekStart)),
        lte(reservation.date, dateKey(weekEnd)),
        inArray(reservation.status, ["confirmed", "seated"]),
        branchFilter,
      ),
    );

  const countByDate = new Map<string, number>();
  for (const r of week) {
    countByDate.set(r.date, (countByDate.get(r.date) ?? 0) + 1);
  }

  const covers = rows
    .filter((r) => r.reservation.status !== "cancelled")
    .reduce((sum, r) => sum + r.reservation.partySize, 0);

  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(weekStart.getTime() + i * 86_400_000);
    return { key: dateKey(d), date: d, count: countByDate.get(dateKey(d)) ?? 0 };
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Reservations</h1>
          <p className="text-sm text-ink-500">
            {scope.current
              ? `${scope.current.name}`
              : "All branches"}{" "}
            · {rows.length} booking{rows.length === 1 ? "" : "s"} · {covers}{" "}
            cover{covers === 1 ? "" : "s"}
          </p>
        </div>
        <NewReservationDialog
          branches={scope.branches}
          defaultBranchId={scope.current?.id ?? scope.branches[0]?.id ?? 0}
          defaultDate={selectedKey}
          branchLocked={scope.locked}
        />
      </header>

      {/* Date strip */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const active = d.key === selectedKey;
          return (
            <Link
              key={d.key}
              href={`/admin/reservations?date=${d.key}`}
              scroll={false}
              className={`flex w-16 shrink-0 flex-col items-center rounded-xl border-2 px-2 py-2 transition ${
                active
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-cream-400 bg-white text-ink-700 hover:border-brand-300"
              }`}
            >
              <span className="text-[10px] font-medium uppercase opacity-80">
                {d.date.toLocaleDateString("en-MY", { weekday: "short" })}
              </span>
              <span className="text-lg leading-tight font-bold">
                {d.date.getDate()}
              </span>
              <span
                className={`text-[10px] ${active ? "opacity-90" : "text-brand-700"}`}
              >
                {d.count > 0 ? `${d.count} bk` : "—"}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-cream-200 text-brand-700">
            <CalendarX className="size-6" />
          </span>
          <div>
            <p className="font-medium text-ink-900">No bookings on this date</p>
            <p className="mt-1 text-sm text-ink-500">
              Pick another day above, or check a different branch.
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map(({ reservation: r, table, branch: b, customer: c }) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                {/* Time */}
                <div className="w-16 shrink-0">
                  <p className="font-display text-lg leading-tight text-ink-900">
                    {to12h(
                      `${String(r.startsAt.getHours()).padStart(2, "0")}:${String(r.startsAt.getMinutes()).padStart(2, "0")}`,
                    )}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {r.durationMinutes}m
                  </p>
                </div>

                {/* Guest */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-medium text-ink-900 hover:text-brand-800 hover:underline"
                    >
                      {r.name}
                    </Link>
                    <Badge variant={STATUS_VARIANT[r.status]}>
                      {RESERVATION_STATUS_LABELS[r.status]}
                    </Badge>
                    {r.occasion !== "none" && (
                      <Badge variant="gold">{OCCASION_LABELS[r.occasion]}</Badge>
                    )}
                    {c.segment === "vip" && <Badge variant="gold">VIP</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {r.reference} · {r.email}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </p>
                  {(r.notes || (c.allergies ?? []).length > 0) && (
                    <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                      {(c.allergies ?? []).length > 0 && (
                        <strong>Allergies: {(c.allergies ?? []).join(", ")}. </strong>
                      )}
                      {r.notes}
                    </p>
                  )}
                </div>

                {/* Table + party */}
                <div className="shrink-0 text-right">
                  <p className="flex items-center justify-end gap-1 font-medium text-ink-900">
                    <Users className="size-3.5 text-brand-700" />
                    {r.partySize}
                  </p>
                  <p className="text-xs text-ink-500">
                    {table.label ?? `Table ${table.number}`} · {table.zone}
                  </p>
                  {!scope.branchId && (
                    <p className="text-[11px] text-ink-500">{b.shortName}</p>
                  )}
                </div>

                <div className="w-full sm:w-auto">
                  <ReservationActions reservationId={r.id} status={r.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-ink-500">
        <CalendarCheck className="size-3.5" />
        Seating a party marks its table occupied; completing it sends the table
        to cleaning.
      </p>
    </div>
  );
}
