import Link from "next/link";
import { eq } from "drizzle-orm";
import { Heart } from "lucide-react";
import { db } from "@/db";
import { favorite, menuItem } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { money } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/data";
import { SafeImage } from "@/components/safe-image";
import { FavoriteToggle } from "@/components/store/favorite-toggle";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const customer = await requireCustomer();

  const rows = await db
    .select({ fav: favorite, item: menuItem })
    .from(favorite)
    .innerJoin(menuItem, eq(favorite.menuItemId, menuItem.id))
    .where(eq(favorite.customerId, customer.id));

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No favourites saved"
        description="Tap the heart on any dish to keep it here for quick reordering."
        action={
          <Button asChild>
            <Link href="/menu">Browse the menu</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(({ item }) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-card border border-cream-400 bg-white shadow-[var(--shadow-card)]"
        >
          <SafeImage
            src={item.image}
            alt={item.name}
            wrapperClassName="h-36 w-full"
          />
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-900">{item.name}</h3>
              <span className="font-display text-base text-brand-700">
                {money(item.price)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-ink-500">
              {item.description}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" className="flex-1" asChild>
                <Link href={`/menu?item=${item.id}`}>Order this</Link>
              </Button>
              <FavoriteToggle menuItemId={item.id} initial />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
