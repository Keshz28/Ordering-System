"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  Gift,
  Inbox,
  Menu as MenuIcon,
  ShoppingBag,
  User,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CartSheet } from "./cart-sheet";

const links = [
  { href: "/menu", label: "Order" },
  { href: "/our-menu", label: "Our menu" },
  { href: "/reserve", label: "Book a table" },
  { href: "/offers", label: "Offers" },
  { href: "/account/orders", label: "My orders" },
];

export function StoreHeader({
  customerName,
  unreadCount,
}: {
  customerName: string | null;
  unreadCount: number;
}) {
  const { count, ready } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [cartOpen, setCartOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-cream-400 bg-cream-100/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-700 text-white shadow-sm">
            <ChefHat className="size-5" />
          </span>
          <span className="font-display text-lg leading-none tracking-tight text-ink-900">
            Bella Cucina
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium transition",
                pathname.startsWith(l.href)
                  ? "bg-brand-50 text-brand-800"
                  : "text-ink-500 hover:bg-cream-200 hover:text-ink-900",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/account/inbox"
            className="relative hidden size-10 place-items-center rounded-full text-ink-700 transition hover:bg-cream-200 sm:grid"
            aria-label="Inbox"
          >
            <Inbox className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-brand-700 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <Link
            href={customerName ? "/account" : "/login"}
            className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-cream-200 sm:flex"
          >
            <User className="size-4" />
            {customerName ? customerName.split(" ")[0] : "Sign in"}
          </Link>

          <Button
            onClick={() => setCartOpen(true)}
            className="relative"
            size="default"
          >
            <ShoppingBag className="size-4" />
            <span className="hidden sm:inline">Cart</span>
            {ready && count > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 text-xs font-bold text-brand-700">
                {count}
              </span>
            )}
          </Button>

          <button
            onClick={() => setOpen((o) => !o)}
            className="grid size-10 place-items-center rounded-full text-ink-700 transition hover:bg-cream-200 md:hidden"
            aria-label="Menu"
            aria-expanded={open}
          >
            <MenuIcon className="size-5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-cream-400 bg-cream-100 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-cream-200"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/account/offers"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-cream-200"
            >
              <Gift className="size-4" /> My offers
            </Link>
            <Link
              href="/account/inbox"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-cream-200"
            >
              <Inbox className="size-4" /> Inbox
              {unreadCount > 0 && (
                <span className="ml-auto rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
            <Link
              href={customerName ? "/account" : "/login"}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-cream-200"
            >
              <User className="size-4" />
              {customerName ? `Signed in as ${customerName}` : "Sign in"}
            </Link>
          </div>
        </div>
      )}

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}
