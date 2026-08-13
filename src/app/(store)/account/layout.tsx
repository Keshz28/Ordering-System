import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { Gift, Heart, Inbox, Receipt, Sparkles, User } from "lucide-react";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { tierFor } from "@/lib/pricing";
import { loyaltyTier } from "@/db/schema";
import { AccountNav } from "@/components/store/account-nav";
import { SignOutButton } from "@/components/store/sign-out-button";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await requireCustomer();
  const tiers = await db.select().from(loyaltyTier).orderBy(loyaltyTier.minPoints);
  const tier = tierFor(tiers, customer.tierPoints);

  const [unreadRow] = await db
    .select({ n: count() })
    .from(notification)
    .where(
      and(eq(notification.customerId, customer.id), isNull(notification.readAt)),
    );

  const links = [
    { href: "/account", label: "Overview", icon: User },
    { href: "/account/orders", label: "Orders", icon: Receipt },
    { href: "/account/offers", label: "My offers", icon: Gift },
    { href: "/account/rewards", label: "Rewards", icon: Sparkles },
    { href: "/account/favorites", label: "Favourites", icon: Heart },
    {
      href: "/account/inbox",
      label: "Inbox",
      icon: Inbox,
      badge: unreadRow?.n ?? 0,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-ink-500 uppercase">
            My account
          </p>
          <h1 className="font-display text-3xl text-ink-900">{customer.name}</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {customer.email}
            {tier ? (
              <>
                {" · "}
                <span style={{ color: tier.color }} className="font-medium">
                  {tier.name} member
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/menu"
            className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
          >
            Order again
          </Link>
          <SignOutButton />
        </div>
      </div>

      <AccountNav
        links={links.map((l) => ({
          href: l.href,
          label: l.label,
          icon: l.label,
          badge: l.badge,
        }))}
      />

      <div className="mt-6">{children}</div>
    </div>
  );
}
