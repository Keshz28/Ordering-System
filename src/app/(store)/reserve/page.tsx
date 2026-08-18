import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { ReservationFlow } from "@/components/reservations/reservation-flow";
import { currentCustomer } from "@/lib/auth";
import { currentBranch, listBranches } from "@/lib/branches";
import { getSettings } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserve a table · Bella Cucina",
  description:
    "Book a table at Bella Cucina Bangsar, Setapak, Bukit Jelutong or Putrajaya. Pick your exact table from the floor plan.",
};

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch: branchSlug } = await searchParams;
  const [branches, settings, customer, active] = await Promise.all([
    listBranches(),
    getSettings(),
    currentCustomer(),
    currentBranch(),
  ]);

  const initial =
    branches.find((b) => b.slug === branchSlug)?.id ?? active?.id ?? branches[0]?.id;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8 max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
          <CalendarCheck className="size-3.5" />
          Table reservations
        </div>
        <h1 className="font-display text-3xl text-balance text-ink-900 sm:text-4xl">
          Choose your table, not just your time
        </h1>
        <p className="mt-3 text-ink-500">
          Pick the branch, the hour and the exact table on the floor plan —
          the same way you&apos;d choose a seat at the cinema. Tables already
          taken are greyed out in real time.
        </p>
      </header>

      {branches.length === 0 ? (
        <p className="rounded-xl border border-cream-400 bg-white p-6 text-ink-500">
          No branches are accepting bookings right now.
        </p>
      ) : (
        <ReservationFlow
          branches={branches}
          settings={settings}
          customer={customer}
          initialBranchId={initial}
        />
      )}
    </div>
  );
}
