import { NextResponse } from "next/server";
import { availabilityAt, slotsFor, toDateKey } from "@/lib/reservations";
import { getSettings } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Availability for one branch/day/party.
 *
 * Returns the slot strip always, and the table map only when a time is given,
 * so the picker can render the day at a glance and then the room once the
 * guest commits to a time.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const branchId = Number(url.searchParams.get("branchId"));
  const dateKey = url.searchParams.get("date") ?? toDateKey(new Date());
  const partySize = Math.max(1, Number(url.searchParams.get("partySize") ?? 2));
  const time = url.searchParams.get("time");

  if (!branchId) {
    return NextResponse.json({ error: "branchId is required." }, { status: 400 });
  }

  const settings = await getSettings();

  if (partySize > settings.reservationMaxPartySize) {
    return NextResponse.json(
      {
        error: `Parties above ${settings.reservationMaxPartySize} need to be booked by phone.`,
        slots: [],
        tables: [],
      },
      { status: 400 },
    );
  }

  const slots = await slotsFor({ branchId, dateKey, partySize, settings });

  const tables = time
    ? (await availabilityAt({ branchId, dateKey, time, partySize, settings })).map(
        (t) => ({
          table: t.table,
          available: t.available,
          reason: t.reason,
        }),
      )
    : [];

  return NextResponse.json({
    dateKey,
    partySize,
    time,
    durationMinutes: settings.reservationDurationMinutes,
    slots: slots.map((s) => ({
      time: s.time,
      label: s.label,
      availableTables: s.availableTables,
      isPast: s.isPast,
    })),
    tables,
  });
}
