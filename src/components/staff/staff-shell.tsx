"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  Gauge,
  LayoutGrid,
  Monitor,
  ShoppingCart,
  Store,
} from "lucide-react";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/store/sign-out-button";

const AREAS = [
  { href: "/kds", label: "Kitchen", icon: Monitor, area: "kds" },
  { href: "/pos", label: "POS", icon: ShoppingCart, area: "pos" },
  { href: "/pos/tables", label: "Tables", icon: LayoutGrid, area: "pos" },
  { href: "/admin", label: "Admin", icon: Gauge, area: "admin" },
];

const ROLE_TONE: Record<Role, string> = {
  owner: "bg-gold-500 text-ink-900",
  manager: "bg-brand-700 text-white",
  cashier: "bg-emerald-600 text-white",
  kitchen: "bg-sky-600 text-white",
};

/** Dark operational chrome for the KDS/POS — deliberately unlike the storefront. */
export function StaffShell({
  session,
  access,
  children,
}: {
  session: { name: string; role: Role };
  access: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const visible = AREAS.filter((a) => access.includes(a.area));

  return (
    <div className="flex min-h-dvh flex-col bg-ink-900 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[110rem] items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-700">
              <ChefHat className="size-5" />
            </span>
            <span className="hidden font-display text-lg leading-none sm:block">
              Bella Cucina
            </span>
          </Link>

          <nav className="ml-4 flex items-center gap-1">
            {visible.map((a) => {
              const active =
                a.href === "/pos"
                  ? pathname === "/pos"
                  : pathname.startsWith(a.href);
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition",
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <a.icon className="size-4" />
                  <span className="hidden sm:inline">{a.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              className="hidden items-center gap-1.5 text-xs text-white/50 transition hover:text-white md:flex"
            >
              <Store className="size-3.5" /> Storefront
            </Link>
            <div className="text-right">
              <p className="text-sm leading-tight font-medium">{session.name}</p>
              <Badge
                className={cn("border-transparent", ROLE_TONE[session.role])}
              >
                {session.role}
              </Badge>
            </div>
            <SignOutButton scope="staff" />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
