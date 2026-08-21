import Link from "next/link";
import { desc, eq, gte } from "drizzle-orm";
import {
  MapPin,
  ArrowRight,
  Bike,
  Clock,
  Gift,
  Star,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { db } from "@/db";
import { promotion, review } from "@/db/schema";
import { getMenu } from "@/lib/menu";
import { listBranches } from "@/lib/branches";
import { getSettings } from "@/lib/pricing";
import { currentCustomer } from "@/lib/auth";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/safe-image";

export default async function StorefrontPage() {
  const [branches, categories, settings, promos, reviews, customer] =
    await Promise.all([
    listBranches(),
    getMenu(),
    getSettings(),
    db
      .select()
      .from(promotion)
      .where(eq(promotion.active, true))
      .orderBy(promotion.sortOrder),
    db
      .select()
      .from(review)
      .where(gte(review.rating, 4))
      .orderBy(desc(review.createdAt))
      .limit(3),
    currentCustomer(),
  ]);

  const banner = promos.find((p) => p.type === "banner");
  const strip = promos.filter((p) => p.type !== "banner").slice(0, 3);
  const featured = categories
    .flatMap((c) => c.items)
    .filter((i) => i.featured)
    .slice(0, 6);

  return (
    <>
      {/* ------------------------------- hero ------------------------------- */}
      <section className="bg-trattoria relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:py-16 lg:grid-cols-2 lg:py-20">
          <div>
            <Badge variant="default" className="mb-4">
              <Star className="size-3 fill-current" /> 4.8 · 320+ reviews
            </Badge>

            <h1 className="font-display text-4xl leading-[1.05] text-balance text-ink-900 sm:text-5xl lg:text-6xl">
              {settings.tagline}
            </h1>

            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-500">
              Seventy-two hour dough, pasta rolled each morning and a wood oven
              that has not gone cold since 2009. Order for the table, the
              counter or your front door.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="xl" asChild>
                <Link href="/menu">
                  Order now <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/offers">
                  <Gift className="size-4" /> See offers
                </Link>
              </Button>
            </div>

            <dl className="mt-9 grid max-w-md grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  icon: MapPin,
                  label: "Branches",
                  value: `${branches.length} outlets`,
                },
                { icon: UtensilsCrossed, label: "Dine-in", value: "Book ahead" },
                { icon: Store, label: "Takeaway", value: "15 min" },
                { icon: Bike, label: "Delivery", value: "3 zones" },
              ].map((s) => (
                <div key={s.label}>
                  <s.icon className="size-5 text-brand-700" />
                  <dt className="mt-1.5 text-xs text-ink-500">{s.label}</dt>
                  <dd className="text-sm font-semibold text-ink-900">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <SafeImage
              src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=70"
              alt="Wood-fired pizza at Bella Cucina"
              wrapperClassName="aspect-4/3 w-full rounded-3xl shadow-[var(--shadow-lift)]"
              priority
            />
            <div className="absolute -bottom-5 -left-2 hidden rounded-2xl border border-cream-400 bg-white p-4 shadow-[var(--shadow-lift)] sm:block">
              <p className="text-xs text-ink-500">Tonight&apos;s wait</p>
              <p className="font-display text-2xl text-ink-900">18 min</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700">
                <Clock className="size-3" /> Kitchen running on time
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- promotions strip ----------------------- */}
      {strip.length > 0 && (
        <section className="border-y border-cream-400 bg-brand-700">
          <div className="no-scrollbar mx-auto flex max-w-6xl gap-3 overflow-x-auto px-4 py-4">
            {strip.map((p) => (
              <div
                key={p.id}
                className="flex min-w-[15rem] flex-1 shrink-0 items-start gap-3 rounded-2xl bg-white/10 px-4 py-3 text-white"
              >
                <Gift className="mt-0.5 size-4 shrink-0 text-gold-400" />
                <div>
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-white/75">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------ banner ------------------------------ */}
      {banner && (
        <section className="mx-auto max-w-6xl px-4 pt-12">
          <div className="relative overflow-hidden rounded-3xl">
            <SafeImage
              src={banner.config?.image}
              alt={banner.title}
              wrapperClassName="h-56 w-full sm:h-72"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-900/85 via-ink-900/55 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center gap-2 p-6 sm:p-10">
              <Badge variant="gold" className="w-fit">
                Limited offer
              </Badge>
              <h2 className="font-display text-2xl text-white sm:text-3xl">
                {banner.title}
              </h2>
              <p className="max-w-sm text-sm text-white/80">
                {banner.description}
              </p>
              <Button variant="gold" className="mt-2 w-fit" asChild>
                <Link href={banner.config?.ctaHref ?? "/menu"}>
                  {banner.config?.ctaLabel ?? "Order now"}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------- favourites --------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink-900">
              What people order
            </h2>
            <p className="text-sm text-ink-500">
              The dishes that keep the oven busy.
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/menu">
              Full menu <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((item) => (
            <Link
              key={item.id}
              href={`/menu?item=${item.id}`}
              className="group overflow-hidden rounded-card border border-cream-400 bg-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
            >
              <SafeImage
                src={item.image}
                alt={item.name}
                wrapperClassName="h-40 w-full"
                className="transition duration-500 group-hover:scale-105"
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink-900">
                    {item.name}
                  </h3>
                  <span className="font-display text-base text-brand-700">
                    {money(item.price)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-ink-500">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------ loyalty ----------------------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="grid gap-4 rounded-3xl border border-cream-400 bg-white p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Badge variant="gold">Bella Rewards</Badge>
            <h2 className="mt-3 font-display text-2xl text-ink-900">
              {customer
                ? `${customer.loyaltyPoints.toLocaleString()} points and counting`
                : "Earn on every plate"}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-500">
              Bronze earns 10 points per dollar. Silver adds 5% off every order
              at 500 points, and Gold unlocks 10% off plus free delivery at
              1,500. Points can be traded for vouchers whenever you like.
            </p>
            <Button className="mt-5" asChild>
              <Link href={customer ? "/account/rewards" : "/login"}>
                {customer ? "View my rewards" : "Join with your email"}
              </Link>
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { name: "Bronze", detail: "10 pts / RM1", at: "0 pts" },
              { name: "Silver", detail: "15 pts / RM1 · 5% off", at: "500 pts" },
              {
                name: "Gold",
                detail: "25 pts / RM1 · 10% off · free delivery",
                at: "1,500 pts",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-cream-400 bg-cream-100 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-900">{t.name}</p>
                  <span className="text-xs text-ink-500">{t.at}</span>
                </div>
                <p className="text-xs text-ink-500">{t.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ reviews ----------------------------- */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="mb-5 font-display text-2xl text-ink-900">
            From the guest book
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {reviews.map((r) => (
              <figure
                key={r.id}
                className="rounded-card border border-cream-400 bg-white p-5"
              >
                <div className="flex gap-0.5 text-gold-500">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-3 text-sm leading-relaxed text-ink-700">
                  “{r.comment}”
                </blockquote>
              </figure>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
