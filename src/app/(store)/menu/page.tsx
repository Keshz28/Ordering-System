import type { Metadata } from "next";
import { branchAvailability, getMenu, upsellSuggestions } from "@/lib/menu";
import { currentBranch } from "@/lib/branches";
import { MenuBrowser } from "@/components/store/menu-browser";

export const metadata: Metadata = { title: "Menu" };
export const dynamic = "force-dynamic";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ category }, allCategories, upsells, branch] = await Promise.all([
    searchParams,
    getMenu(),
    upsellSuggestions(5),
    currentBranch(),
  ]);

  // Hide what this outlet has taken off tonight, so the cart can't be built
  // from dishes the branch would only reject at checkout.
  const availability = branch ? await branchAvailability(branch.id) : null;
  const categories = availability
    ? allCategories
        .map((c) => ({
          ...c,
          items: c.items.filter((i) => availability.isAvailable(i.id)),
        }))
        .filter((c) => c.items.length > 0)
    : allCategories;

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="pt-8 pb-2">
        <h1 className="font-display text-3xl text-ink-900">Order online</h1>
        <p className="mt-1 text-sm text-ink-500">
          {branch ? `From our ${branch.shortName} kitchen — ` : ""}everything is
          made to order. Tell us about allergies and we&apos;ll work around them.
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
