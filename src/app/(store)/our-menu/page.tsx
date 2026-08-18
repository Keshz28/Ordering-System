import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Clock, Flame, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/safe-image";
import { PrintButton } from "@/components/store/print-button";
import { listBranches } from "@/lib/branches";
import { branchAvailability, getMenu } from "@/lib/menu";
import { getSettings } from "@/lib/pricing";
import { money } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our menu · Bella Cucina",
  description:
    "The full Bella Cucina menu — every dish, description, allergen and price across our Bangsar, Setapak, Bukit Jelutong and Putrajaya branches.",
};

/**
 * The reference menu: everything on offer, with allergens and prices, and no
 * cart in sight. This is the page to print, to put behind a QR code on the
 * table, and to send to someone deciding where to eat — distinct from /menu,
 * which exists to take an order.
 */
export default async function OurMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch: branchSlug } = await searchParams;
  const [categories, branches, settings] = await Promise.all([
    getMenu({ storefront: false }),
    listBranches(),
    getSettings(),
  ]);

  const selected =
    branches.find((b) => b.slug === branchSlug) ?? branches[0] ?? null;
  const availability = selected ? await branchAvailability(selected.id) : null;

  const visible = categories
    .map((c) => ({ ...c, items: c.items.filter((i) => i.isAvailable) }))
    .filter((c) => c.items.length > 0);

  const allergenList = [
    ...new Set(visible.flatMap((c) => c.items.flatMap((i) => i.allergens ?? []))),
  ].sort();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
          <UtensilsCrossed className="size-3.5" />
          The full menu
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl text-balance text-ink-900 sm:text-4xl">
              Everything we cook
            </h1>
            <p className="mt-3 text-ink-500">
              Prices are the same at every branch and include no hidden charges —
              a {Math.round(settings.serviceChargeRate * 100)}% service charge and{" "}
              {Math.round(settings.taxRate * 100)}% {settings.taxLabel} are added
              at the till.
            </p>
          </div>
          <div className="no-print flex gap-2">
            <Button asChild variant="outline">
              <Link href="/menu">Order online</Link>
            </Button>
            <Button asChild>
              <Link href="/reserve">Book a table</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Branch selector — only availability changes, never the price. */}
      {branches.length > 1 && (
        <div className="no-print mb-8 rounded-2xl border border-cream-400 bg-white p-4">
          <p className="mb-2.5 text-sm font-medium text-ink-700">
            Checking availability at
          </p>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => {
              const active = b.id === selected?.id;
              return (
                <Link
                  key={b.id}
                  href={`/our-menu?branch=${b.slug}`}
                  scroll={false}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                    active
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-cream-500 bg-white text-ink-700 hover:border-brand-400",
                  )}
                >
                  {b.shortName}
                </Link>
              );
            })}
          </div>
          {selected && (
            <p className="mt-2.5 text-xs text-ink-500">
              {selected.address}, {selected.postcode} {selected.city} ·{" "}
              {selected.phone}
            </p>
          )}
        </div>
      )}

      {/* Jump links */}
      <nav className="no-scrollbar no-print mb-10 -mx-4 flex gap-2 overflow-x-auto px-4">
        {visible.map((c) => (
          <a
            key={c.id}
            href={`#cat-${c.id}`}
            className="shrink-0 rounded-full border border-cream-500 bg-white px-3.5 py-1.5 text-sm font-medium text-ink-700 transition hover:border-brand-400 hover:text-brand-800"
          >
            {c.name}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-12">
        {visible.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-24">
            <div className="mb-5 border-b border-cream-400 pb-3">
              <h2 className="font-display text-2xl text-ink-900">{c.name}</h2>
              {c.description && (
                <p className="mt-1 text-sm text-ink-500">{c.description}</p>
              )}
            </div>

            <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {c.items.map((item) => {
                const unavailableHere =
                  availability && !availability.isAvailable(item.id);
                return (
                  <li key={item.id} className="flex gap-3.5">
                    <SafeImage
                      src={item.image}
                      alt={item.name}
                      className="size-20 shrink-0 rounded-xl object-cover sm:size-24"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-semibold text-ink-900">
                          {item.name}
                        </h3>
                        <span className="shrink-0 font-display text-lg text-brand-800 tabular-nums">
                          {money(item.price, settings.currencySymbol)}
                        </span>
                      </div>

                      {item.description && (
                        <p className="mt-1 text-sm leading-relaxed text-ink-500">
                          {item.description}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {item.featured && (
                          <Badge variant="gold">
                            <Flame className="size-3" /> Popular
                          </Badge>
                        )}
                        <Badge variant="neutral">
                          <Clock className="size-3" /> {item.prepMinutes} min
                        </Badge>
                        {(item.allergens ?? []).map((a) => (
                          <Badge key={a} variant="outline">
                            {a}
                          </Badge>
                        ))}
                        {item.availableFrom && item.availableTo && (
                          <Badge variant="info">
                            {item.availableFrom}–{item.availableTo}
                          </Badge>
                        )}
                        {unavailableHere && (
                          <Badge variant="danger">
                            Not at {selected?.shortName}
                          </Badge>
                        )}
                      </div>

                      {/* Options that change the price are worth stating up front. */}
                      {item.groups.some((g) =>
                        g.options.some((o) => o.priceDelta !== 0),
                      ) && (
                        <dl className="mt-2 space-y-1">
                          {item.groups
                            .filter((g) =>
                              g.options.some((o) => o.priceDelta !== 0),
                            )
                            .map((g) => (
                              <div key={g.id} className="text-xs text-ink-500">
                                <dt className="inline font-medium">{g.name}:</dt>{" "}
                                <dd className="inline">
                                  {g.options
                                    .filter((o) => o.priceDelta !== 0)
                                    .map(
                                      (o) =>
                                        `${o.name} ${o.priceDelta > 0 ? "+" : "−"}${money(
                                          Math.abs(o.priceDelta),
                                          settings.currencySymbol,
                                        )}`,
                                    )
                                    .join(" · ")}
                                </dd>
                              </div>
                            ))}
                        </dl>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {allergenList.length > 0 && (
        <footer className="mt-14 rounded-2xl border border-cream-400 bg-cream-200 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-brand-700" />
            <div>
              <h2 className="font-semibold text-ink-900">Allergens</h2>
              <p className="mt-1 text-sm text-ink-500">
                Dishes are tagged with {allergenList.join(", ")}. Our kitchen
                handles all of these, so we can&apos;t guarantee any dish is
                entirely free of traces — please tell us about an allergy when
                you order or book and we&apos;ll work around it.
              </p>
            </div>
          </div>
          <div className="mt-3 sm:ml-8">
            <PrintButton />
          </div>
        </footer>
      )}
    </div>
  );
}
