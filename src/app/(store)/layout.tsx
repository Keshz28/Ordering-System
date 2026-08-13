import Link from "next/link";
import { and, eq, isNull, count } from "drizzle-orm";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { currentCustomer } from "@/lib/auth";
import { getSettings } from "@/lib/pricing";
import { CartProvider } from "@/lib/cart";
import { StoreHeader } from "@/components/store/store-header";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [customer, settings] = await Promise.all([
    currentCustomer(),
    getSettings(),
  ]);

  let unread = 0;
  if (customer) {
    const [row] = await db
      .select({ n: count() })
      .from(notification)
      .where(
        and(
          eq(notification.customerId, customer.id),
          isNull(notification.readAt),
        ),
      );
    unread = row?.n ?? 0;
  }

  return (
    <CartProvider>
      <div className="flex min-h-dvh flex-col">
        <StoreHeader
          customerName={customer?.name ?? null}
          unreadCount={unread}
        />
        <main className="flex-1">{children}</main>

        <footer className="mt-16 border-t border-cream-400 bg-cream-200/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
            <div>
              <p className="font-display text-lg text-ink-900">
                {settings.restaurantName}
              </p>
              <p className="mt-1 text-sm text-ink-500">{settings.tagline}</p>
              <p className="mt-3 text-sm text-ink-500">{settings.address}</p>
              <p className="text-sm text-ink-500">{settings.phone}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink-900">Opening hours</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-500">
                {Object.entries(settings.openingHours ?? {}).map(
                  ([day, hours]) => (
                    <li key={day} className="flex justify-between gap-4">
                      <span className="capitalize">{day.slice(0, 3)}</span>
                      <span className="tabular-nums">
                        {hours.closed
                          ? "Closed"
                          : `${hours.open} – ${hours.close}`}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink-900">Quick links</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {[
                  { href: "/menu", label: "Full menu" },
                  { href: "/offers", label: "Offers & rewards" },
                  { href: "/account/orders", label: "My orders" },
                  { href: "/demo", label: "Demo launcher" },
                  { href: "/staff/login", label: "Staff sign-in" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-ink-500 transition hover:text-brand-700"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-cream-400 px-4 py-4">
            <p className="mx-auto max-w-6xl text-xs text-ink-500">
              Demonstration system · payments run in test mode · no real orders
              are fulfilled.
            </p>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
