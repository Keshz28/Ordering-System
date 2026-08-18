import type { Metadata } from "next";
import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import {
  ArrowRight,
  ChefHat,
  CreditCard,
  Gauge,
  KeyRound,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { db } from "@/db";
import { customer, menuItem, order } from "@/db/schema";
import { stripeEnabled } from "@/lib/payments";
import { emailEnabled } from "@/lib/notify";
import { getSettings } from "@/lib/pricing";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Demo launcher",
  description: "Three doors into the Bella Cucina demo.",
};
export const dynamic = "force-dynamic";

const SURFACES = [
  {
    href: "/menu",
    icon: ShoppingBag,
    title: "Order food",
    subtitle: "Customer storefront",
    body: "Browse the menu, customise a pizza, apply a voucher and pay with the test card.",
    tone: "bg-brand-700 text-white",
  },
  {
    href: "/kds",
    icon: ChefHat,
    title: "Kitchen view",
    subtitle: "Kitchen display system",
    body: "Watch tickets land, see SLA timers turn amber then red, and bump orders through the pass.",
    tone: "bg-ink-900 text-white",
  },
  {
    href: "/admin",
    icon: Gauge,
    title: "Admin panel",
    subtitle: "Owner back office",
    body: "Analytics, menu management, the voucher engine, CRM segments and campaign recipes.",
    tone: "bg-gold-500 text-ink-900",
  },
];

export default async function DemoPage() {
  const [settings, [items], [customers], [orders], [revenue]] =
    await Promise.all([
      getSettings(),
      db.select({ n: count() }).from(menuItem),
      db.select({ n: count() }).from(customer),
      db.select({ n: count() }).from(order),
      db
        .select({ total: sql<number>`coalesce(sum(${order.total}), 0)` })
        .from(order)
        .where(eq(order.status, "completed")),
    ]);

  return (
    <div className="bg-trattoria min-h-dvh">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <header className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-700 text-white shadow-lg">
            <ChefHat className="size-7" />
          </span>
          <h1 className="mt-5 font-display text-4xl leading-tight text-balance text-ink-900">
            {settings.restaurantName}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">
            A complete restaurant ordering and CRM system. Pick a door below —
            each one is a live surface running on the same seeded data.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            <Badge variant="neutral">{items.n} menu items</Badge>
            <Badge variant="neutral">{customers.n} customers</Badge>
            <Badge variant="neutral">{orders.n} orders</Badge>
            <Badge variant="neutral">
              {money(Number(revenue.total))} revenue
            </Badge>
          </div>
        </header>

        <div className="mt-9 space-y-3">
          {SURFACES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center gap-4 rounded-3xl border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[var(--shadow-lift)] sm:p-6"
            >
              <span
                className={`grid size-14 shrink-0 place-items-center rounded-2xl ${s.tone} shadow-sm`}
              >
                <s.icon className="size-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs tracking-wide text-ink-500 uppercase">
                  {s.subtitle}
                </p>
                <p className="font-display text-xl text-ink-900">{s.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-500">
                  {s.body}
                </p>
              </div>
              <ArrowRight className="size-5 shrink-0 text-ink-500 transition group-hover:translate-x-1 group-hover:text-brand-700" />
            </Link>
          ))}
        </div>

        {/* ------------------------------ credentials ------------------------- */}
        <section className="mt-8 rounded-3xl border border-cream-400 bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink-900">
            <KeyRound className="size-4 text-brand-700" /> Sign-in details
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Staff · password demo1234
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-ink-700">
                <li>owner@bellacucina.demo</li>
                <li>manager@bellacucina.demo</li>
                <li>cashier@bellacucina.demo</li>
                <li>kitchen@bellacucina.demo</li>
              </ul>
              <Link
                href="/staff/login"
                className="mt-2 inline-block text-xs font-medium text-brand-700 underline underline-offset-2"
              >
                Go to staff sign-in
              </Link>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Customers · no password
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-700">
                Enter <strong>any</strong> email — including your own — and a
                6-digit code appears on screen and in the in-app Inbox.
              </p>
              <p className="mt-1.5 text-xs text-ink-500">
                Try a seeded VIP: <br />
                <code className="font-mono">amelia.hart@example.com</code>
              </p>
              <Link
                href="/login"
                className="mt-2 inline-block text-xs font-medium text-brand-700 underline underline-offset-2"
              >
                Go to customer sign-in
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------- config ---------------------------- */}
        <section className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-cream-400 bg-white/70 p-4">
            <CreditCard className="mt-0.5 size-4 shrink-0 text-brand-700" />
            <div>
              <p className="text-sm font-medium text-ink-900">
                Payments: {stripeEnabled() ? "Stripe test mode" : "Simulated"}
              </p>
              <p className="text-xs text-ink-500">
                {stripeEnabled()
                  ? "Card orders open a real Stripe test Checkout. Use 4242 4242 4242 4242."
                  : "No Stripe key set, so checkout settles instantly through the same payment state machine."}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-cream-400 bg-white/70 p-4">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-700" />
            <div>
              <p className="text-sm font-medium text-ink-900">
                Email: {emailEnabled() ? "Resend live" : "In-app inbox"}
              </p>
              <p className="text-xs text-ink-500">
                {emailEnabled()
                  ? "Login codes and campaigns are sent as real email via Resend."
                  : "Login codes show on screen and in the Inbox. Add RESEND_API_KEY to send real email."}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-cream-400 bg-white/70 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
            <Users className="size-4 text-brand-700" /> The two-minute wow
          </p>
          <ol className="mt-2 space-y-1 text-xs leading-relaxed text-ink-500">
            <li>
              1. Place an order on your phone and sign in with your own email.
            </li>
            <li>2. Open the kitchen view and bump the ticket to Ready.</li>
            <li>
              3. In Admin → Customers, find your email and issue a personal RM15
              voucher.
            </li>
            <li>
              4. Refresh My offers on the phone — it&apos;s already there,
              ready to use.
            </li>
          </ol>
        </section>

        <p className="mt-8 text-center text-xs text-ink-500">
          Demonstration system · no real orders are fulfilled and no real
          payments are taken.
        </p>
      </div>
    </div>
  );
}
