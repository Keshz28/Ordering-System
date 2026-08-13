"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gift,
  Heart,
  Inbox,
  Receipt,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Overview: User,
  Orders: Receipt,
  "My offers": Gift,
  Rewards: Sparkles,
  Favourites: Heart,
  Inbox: Inbox,
};

export function AccountNav({
  links,
}: {
  links: { href: string; label: string; icon: string; badge?: number }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar mt-6 flex gap-1.5 overflow-x-auto border-b border-cream-400 pb-0">
      {links.map((l) => {
        const Icon = ICONS[l.icon] ?? User;
        const active =
          l.href === "/account"
            ? pathname === "/account"
            : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition",
              active
                ? "border-brand-700 text-brand-800"
                : "border-transparent text-ink-500 hover:border-cream-500 hover:text-ink-900",
            )}
          >
            <Icon className="size-4" />
            {l.label}
            {l.badge ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-brand-700 px-1.5 text-[10px] font-bold text-white">
                {l.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
