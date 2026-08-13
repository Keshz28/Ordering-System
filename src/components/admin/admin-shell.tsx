"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  Gauge,
  Gift,
  Megaphone,
  Menu as MenuIcon,
  Monitor,
  Settings,
  ShoppingCart,
  Star,
  Store,
  Tag,
  UtensilsCrossed,
  Users,
  X,
} from "lucide-react";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/store/sign-out-button";

const NAV: {
  group: string;
  items: { href: string; label: string; icon: typeof Gauge; roles?: Role[] }[];
}[] = [
  {
    group: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: Gauge },
      { href: "/admin/orders", label: "Orders", icon: ClipboardList },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    group: "Menu",
    items: [
      { href: "/admin/menu", label: "Menu & stock", icon: UtensilsCrossed },
    ],
  },
  {
    group: "Marketing",
    items: [
      { href: "/admin/vouchers", label: "Vouchers", icon: Tag },
      { href: "/admin/promotions", label: "Promotions", icon: Gift },
      { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
    ],
  },
  {
    group: "Customers",
    items: [
      { href: "/admin/customers", label: "CRM", icon: Users },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/kds", label: "Kitchen display", icon: Monitor },
      { href: "/pos", label: "Point of sale", icon: ShoppingCart },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: Settings,
        roles: ["owner"],
      },
      {
        href: "/admin/staff",
        label: "Staff & activity",
        icon: Users,
        roles: ["owner"],
      },
    ],
  },
];

export function AdminShell({
  session,
  children,
}: {
  session: { name: string; role: Role };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const nav = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(session.role)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-dvh bg-cream-100">
      {/* ------------------------------- sidebar ---------------------------- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-cream-400 bg-white transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-cream-400 px-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-700 text-white">
              <ChefHat className="size-5" />
            </span>
            <span>
              <span className="block font-display text-base leading-none text-ink-900">
                Bella Cucina
              </span>
              <span className="block text-[11px] text-ink-500">Back office</span>
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto grid size-8 place-items-center rounded-full text-ink-500 hover:bg-cream-200 lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {nav.map((group) => (
            <div key={group.group}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-500 uppercase">
                {group.group}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                        active
                          ? "bg-brand-50 text-brand-800"
                          : "text-ink-700 hover:bg-cream-200",
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-cream-400 p-3">
          <Link
            href="/"
            className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-500 transition hover:bg-cream-200 hover:text-ink-900"
          >
            <Store className="size-4" /> View storefront
          </Link>
          <div className="flex items-center gap-2 rounded-xl bg-cream-100 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">
                {session.name}
              </p>
              <Badge variant="neutral" className="mt-0.5 capitalize">
                {session.role}
              </Badge>
            </div>
          </div>
          <div className="mt-2">
            <SignOutButton scope="staff" />
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* -------------------------------- main ------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-cream-400 bg-cream-100/90 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="grid size-10 place-items-center rounded-full text-ink-700 hover:bg-cream-200"
            aria-label="Open menu"
          >
            <MenuIcon className="size-5" />
          </button>
          <span className="font-display text-lg text-ink-900">Back office</span>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
