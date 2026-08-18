import { Bike, MapPin, Phone, Star, Store } from "lucide-react";
import type { DeliveryJob } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DELIVERY_STAGE_ORDER,
  DELIVERY_STATUS_LABELS,
} from "@/lib/delivery";
import { cn, money } from "@/lib/utils";

/**
 * The rider card the customer watches while waiting.
 *
 * Deliberately shows the same facts a real courier webhook provides — driver,
 * plate, distance, ETA and a progress fraction — so swapping the simulator for
 * Lalamove or Grab changes the data source, not this component.
 */
export function DeliveryTracker({ job }: { job: DeliveryJob }) {
  const stageIndex = DELIVERY_STAGE_ORDER.indexOf(job.status);
  const progress =
    job.status === "delivered"
      ? 1
      : Math.max(job.progress, stageIndex >= 0 ? stageIndex / 5 : 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-cream-400 bg-cream-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <Bike className="size-4 text-brand-700" />
          <h2 className="font-display text-lg text-ink-900">Your delivery</h2>
        </div>
        <Badge variant={job.status === "delivered" ? "success" : "default"}>
          {DELIVERY_STATUS_LABELS[job.status]}
        </Badge>
      </div>

      <div className="p-5">
        {/* Route line: kitchen -> rider -> door */}
        <div className="relative mb-6 pt-1">
          <div className="h-1.5 w-full rounded-full bg-cream-300">
            <div
              className="h-full rounded-full bg-brand-700 transition-[width] duration-700"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <span
            className="absolute -top-1 grid size-7 -translate-x-1/2 place-items-center rounded-full border-2 border-brand-700 bg-white shadow-sm transition-[left] duration-700"
            style={{ left: `${Math.round(progress * 100)}%` }}
            aria-hidden
          >
            <Bike className="size-3.5 text-brand-700" />
          </span>
          <div className="mt-3 flex items-start justify-between gap-4 text-xs">
            <span className="flex max-w-[45%] items-start gap-1.5 text-ink-500">
              <Store className="mt-0.5 size-3.5 shrink-0" />
              <span className="truncate">{job.pickupAddress}</span>
            </span>
            <span className="flex max-w-[45%] items-start gap-1.5 text-right text-ink-500">
              <span className="truncate">{job.dropoffAddress}</span>
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
            </span>
          </div>
        </div>

        {job.driverName ? (
          <div className="flex items-center gap-3 rounded-xl border border-cream-400 bg-white p-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-800">
              {job.driverName
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink-900">
                {job.driverName}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                <span className="font-mono">{job.plateNumber}</span>
                {job.driverRating != null && (
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="size-3 fill-gold-500 text-gold-500" />
                    {job.driverRating.toFixed(1)}
                  </span>
                )}
                <span className="capitalize">{job.vehicleType}</span>
              </p>
            </div>
            {job.driverPhone && (
              <a
                href={`tel:${job.driverPhone.replace(/\s/g, "")}`}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-cream-500 text-brand-700 transition hover:border-brand-500 hover:bg-brand-50"
                aria-label={`Call ${job.driverName}`}
              >
                <Phone className="size-4" />
              </a>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-cream-400 bg-cream-100 p-3.5 text-sm text-ink-500">
            Finding a rider near {job.pickupAddress?.split(",")[0]}…
          </p>
        )}

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Distance" value={`${job.distanceKm} km`} />
          <Stat
            label={job.status === "delivered" ? "Delivered in" : "ETA"}
            value={`${job.etaMinutes} min`}
          />
          <Stat label="Delivery fee" value={money(job.fee)} />
        </dl>

        <p className="mt-4 text-center text-xs text-ink-500">
          {job.provider === "simulated"
            ? "Simulated courier — swap in Lalamove, Grab Express or Delyva with one config change."
            : `Dispatched via ${job.provider.replace("_", " ")} · ${job.providerRef}`}
        </p>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("rounded-xl border border-cream-400 bg-cream-100 p-2.5")}>
      <dt className="text-[10px] tracking-wide text-ink-500 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-ink-900 tabular-nums">{value}</dd>
    </div>
  );
}
