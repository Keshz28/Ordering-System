"use client";

import * as React from "react";
import { Flame, Plus, Search, Timer, X } from "lucide-react";
import { toast } from "sonner";
import type { MenuCategory, MenuItemWithMods } from "@/lib/menu";
import type { MenuItem } from "@/db/schema";
import { useCart } from "@/lib/cart";
import { cn, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/data";
import { SafeImage } from "@/components/safe-image";
import { ItemDialog } from "./item-dialog";
import { UpsellDialog } from "./upsell-dialog";

export function MenuBrowser({
  categories,
  upsells,
  initialCategory,
}: {
  categories: MenuCategory[];
  upsells: MenuItem[];
  initialCategory?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(
    initialCategory ?? categories[0]?.name ?? "",
  );
  const [selected, setSelected] = React.useState<MenuItemWithMods | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [upsellFor, setUpsellFor] = React.useState<MenuItemWithMods | null>(null);
  const sectionRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const { add } = useCart();

  const filtered = React.useMemo(() => {
    if (!query.trim()) return categories;
    const q = query.toLowerCase();
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description ?? "").toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, query]);

  // Highlight the category whose section currently owns the viewport.
  React.useEffect(() => {
    if (query) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target instanceof HTMLElement && visible.target.dataset.category) {
          setActive(visible.target.dataset.category);
        }
      },
      { rootMargin: "-140px 0px -65% 0px", threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [query, categories]);

  function openItem(item: MenuItemWithMods) {
    if (item.soldOut) return;
    if (item.groups.length === 0) {
      // Nothing to configure — straight into the cart, then offer the upsell.
      add({
        menuItemId: item.id,
        name: item.name,
        image: item.image,
        basePrice: item.price,
        unitPrice: item.price,
        quantity: 1,
        note: null,
        modifiers: [],
      });
      setUpsellFor(item);
      return;
    }
    setSelected(item);
    setDialogOpen(true);
  }

  function scrollTo(name: string) {
    setActive(name);
    sectionRefs.current[name]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <>
      <div className="sticky top-16 z-30 -mx-4 border-b border-cream-400 bg-cream-100/90 px-4 py-3 backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu…"
            className="pl-10"
            aria-label="Search the menu"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-3 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-500 hover:bg-cream-300"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {!query && (
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => scrollTo(c.name)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                  active === c.name
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-cream-400 bg-white text-ink-700 hover:border-brand-300",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-10 py-8">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`Nothing matches “${query}”`}
            description="Try a different dish, ingredient or category."
            action={
              <Button variant="outline" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          filtered.map((c) => (
            <section
              key={c.id}
              data-category={c.name}
              ref={(el) => {
                sectionRefs.current[c.name] = el;
              }}
              className="scroll-mt-40"
            >
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-ink-900">{c.name}</h2>
                  {c.description && (
                    <p className="text-sm text-ink-500">{c.description}</p>
                  )}
                </div>
                <span className="text-xs text-ink-500">
                  {c.items.length} dishes
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {c.items.map((item) => (
                  <ItemCard key={item.id} item={item} onOpen={openItem} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <ItemDialog
        item={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdded={(item) => {
          toast.success(`${item.name} added to your order`);
          setUpsellFor(item);
        }}
      />

      <UpsellDialog
        trigger={upsellFor}
        suggestions={upsells}
        onOpenChange={(open) => !open && setUpsellFor(null)}
      />
    </>
  );
}

function ItemCard({
  item,
  onOpen,
}: {
  item: MenuItemWithMods;
  onOpen: (item: MenuItemWithMods) => void;
}) {
  const lowStock = item.stock !== null && item.stock > 0 && item.stock <= 5;

  return (
    <button
      onClick={() => onOpen(item)}
      disabled={item.soldOut}
      className={cn(
        "group relative flex overflow-hidden rounded-card border border-cream-400 bg-white text-left shadow-[var(--shadow-card)] transition sm:flex-col",
        item.soldOut
          ? "cursor-not-allowed opacity-60"
          : "hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[var(--shadow-lift)]",
      )}
    >
      <SafeImage
        src={item.image}
        alt={item.name}
        wrapperClassName="size-28 shrink-0 sm:h-40 sm:w-full"
        className="transition duration-500 group-hover:scale-105"
      />

      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm leading-snug font-semibold text-ink-900">
            {item.name}
          </h3>
          <span className="font-display text-base whitespace-nowrap text-brand-700">
            {money(item.price)}
          </span>
        </div>

        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
          {item.description}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2.5">
          {item.featured && (
            <Badge variant="gold">
              <Flame className="size-3" /> Popular
            </Badge>
          )}
          <Badge variant="neutral">
            <Timer className="size-3" /> {item.prepMinutes}m
          </Badge>
          {item.soldOut ? (
            <Badge variant="danger">Sold out</Badge>
          ) : lowStock ? (
            <Badge variant="warning">Only {item.stock} left</Badge>
          ) : null}
          {(item.allergens ?? []).slice(0, 2).map((a) => (
            <Badge key={a} variant="outline" className="capitalize">
              {a}
            </Badge>
          ))}
        </div>
      </div>

      {!item.soldOut && (
        <span className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-brand-700 text-white opacity-0 shadow-md transition group-hover:opacity-100 sm:top-[8.25rem]">
          <Plus className="size-4" />
        </span>
      )}
    </button>
  );
}
