import type { Metadata } from "next";
import { getMenu, upsellSuggestions } from "@/lib/menu";
import { MenuBrowser } from "@/components/store/menu-browser";

export const metadata: Metadata = { title: "Menu" };
export const dynamic = "force-dynamic";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ category }, categories, upsells] = await Promise.all([
    searchParams,
    getMenu(),
    upsellSuggestions(5),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="pt-8 pb-2">
        <h1 className="font-display text-3xl text-ink-900">Our menu</h1>
        <p className="mt-1 text-sm text-ink-500">
          Everything is made to order — tell us about allergies and we&apos;ll
          work around them.
        </p>
      </div>

      <MenuBrowser
        categories={categories}
        upsells={upsells}
        initialCategory={category}
      />
    </div>
  );
}
