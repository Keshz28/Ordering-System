"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Loader2,
  Package,
  Plus,
  Settings2,
  Star,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { MenuCategory, MenuItemWithMods } from "@/lib/menu";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SafeImage } from "@/components/safe-image";

async function patch(entity: string, id: number, body: object) {
  const res = await fetch("/api/admin/menu", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entity, id, patch: body }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Update failed");
  }
}

export function MenuManager({
  categories,
  soldThisWeek,
}: {
  categories: MenuCategory[];
  soldThisWeek: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<MenuItemWithMods | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  async function toggle(item: MenuItemWithMods, field: "isAvailable" | "featured") {
    setBusyId(item.id);
    try {
      await patch("item", item.id, { [field]: !item[field] });
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New item
        </Button>
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <section key={category.id}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-display text-xl text-ink-900">
                {category.name}
              </h2>
              <Badge variant="neutral">{category.items.length} items</Badge>
              {!category.active && <Badge variant="danger">Hidden</Badge>}
            </div>

            <div className="overflow-hidden rounded-card border border-cream-400 bg-white shadow-[var(--shadow-card)]">
              <ul className="divide-y divide-cream-300">
                {category.items.map((item) => {
                  const sold = soldThisWeek[item.id] ?? 0;
                  const lowStock =
                    item.stock !== null && item.stock > 0 && item.stock <= 5;
                  return (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap"
                    >
                      <SafeImage
                        src={item.image}
                        alt={item.name}
                        wrapperClassName="size-12 shrink-0 rounded-xl"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-medium text-ink-900">{item.name}</p>
                          {item.featured && (
                            <Badge variant="gold">
                              <Star className="size-3" /> Featured
                            </Badge>
                          )}
                          {item.soldOut && <Badge variant="danger">Sold out</Badge>}
                          {lowStock && (
                            <Badge variant="warning">
                              <Package className="size-3" /> {item.stock} left
                            </Badge>
                          )}
                          {item.availableFrom && (
                            <Badge variant="info">
                              <Clock className="size-3" /> {item.availableFrom}–
                              {item.availableTo}
                            </Badge>
                          )}
                          {item.groups.length > 0 && (
                            <Badge variant="neutral">
                              {item.groups.length} modifier group
                              {item.groups.length === 1 ? "" : "s"}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-ink-500">
                        <TrendingUp className="size-3.5" />
                        <span>
                          <strong className="text-ink-900">{sold}</strong> sold
                          this week
                        </span>
                      </div>

                      <span className="w-20 text-right font-display text-lg text-brand-700">
                        {money(item.price)}
                      </span>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-ink-500">
                          {busyId === item.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Switch
                              checked={item.isAvailable}
                              onCheckedChange={() => toggle(item, "isAvailable")}
                            />
                          )}
                          Live
                        </label>
                        <Button
                          size="iconSm"
                          variant="ghost"
                          onClick={() => setEditing(item)}
                          title="Edit item"
                        >
                          <Settings2 />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))}
      </div>

      <ItemEditor
        item={editing}
        categories={categories}
        onClose={() => setEditing(null)}
      />
      <ItemCreator
        open={creating}
        categories={categories}
        onClose={() => setCreating(false)}
      />
    </>
  );
}

function ItemEditor({
  item,
  categories,
  onClose,
}: {
  item: MenuItemWithMods | null;
  categories: MenuCategory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: "",
    price: "0",
    stock: "",
    prepMinutes: "12",
    availableFrom: "",
    availableTo: "",
    categoryId: "",
    featured: false,
  });
  const [busy, setBusy] = React.useState(false);

  // Loads the selected item into the edit form.
  React.useEffect(() => {
    if (!item) return;
    // Deliberate: syncing local state to a prop/storage change after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: item.name,
      price: String(item.price),
      stock: item.stock === null ? "" : String(item.stock),
      prepMinutes: String(item.prepMinutes),
      availableFrom: item.availableFrom ?? "",
      availableTo: item.availableTo ?? "",
      categoryId: String(item.categoryId),
      featured: item.featured,
    });
  }, [item]);

  if (!item) return null;
  const dish = item;

  async function save() {
    setBusy(true);
    try {
      await patch("item", dish.id, {
        name: form.name,
        price: Number(form.price),
        // Empty means untracked stock, which is different from zero.
        stock: form.stock === "" ? null : Number(form.stock),
        prepMinutes: Number(form.prepMinutes),
        availableFrom: form.availableFrom || null,
        availableTo: form.availableTo || null,
        categoryId: Number(form.categoryId),
        featured: form.featured,
      });
      toast.success(`${form.name} updated`);
      onClose();
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="center" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dish.name}</DialogTitle>
          <DialogDescription>
            Changes apply to the storefront immediately. Past orders keep their
            original prices.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 pb-4">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <Input
                value={form.price}
                inputMode="decimal"
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <NativeSelect
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock" hint="Blank = not tracked, 0 = sold out">
              <Input
                value={form.stock}
                inputMode="numeric"
                placeholder="Not tracked"
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </Field>
            <Field label="Prep minutes">
              <Input
                value={form.prepMinutes}
                inputMode="numeric"
                onChange={(e) =>
                  setForm({ ...form, prepMinutes: e.target.value })
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Available from" hint="24h, blank = all day">
              <Input
                value={form.availableFrom}
                placeholder="17:00"
                onChange={(e) =>
                  setForm({ ...form, availableFrom: e.target.value })
                }
              />
            </Field>
            <Field label="Available to">
              <Input
                value={form.availableTo}
                placeholder="23:00"
                onChange={(e) =>
                  setForm({ ...form, availableTo: e.target.value })
                }
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-cream-400 px-3.5 py-3">
            <Switch
              checked={form.featured}
              onCheckedChange={(v) => setForm({ ...form, featured: v })}
            />
            <span className="text-sm text-ink-700">
              Show a &ldquo;Popular&rdquo; badge on the storefront
            </span>
          </label>

          {dish.groups.length > 0 && (
            <div className="rounded-xl border border-cream-400 p-3.5">
              <p className="text-sm font-semibold text-ink-900">
                Modifier groups
              </p>
              <ul className="mt-2 space-y-2">
                {dish.groups.map((g) => (
                  <li key={g.id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-ink-900">{g.name}</span>
                      <Badge variant={g.required ? "default" : "neutral"}>
                        {g.required ? "Required" : "Optional"}
                      </Badge>
                      <Badge variant="neutral">
                        {g.selectionType === "single"
                          ? "Choose one"
                          : `Up to ${g.maxSelection}`}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {g.options
                        .map(
                          (o) =>
                            `${o.name}${
                              o.priceDelta ? ` (${money(o.priceDelta)})` : ""
                            }`,
                        )
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-cream-400 p-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemCreator({
  open,
  categories,
  onClose,
}: {
  open: boolean;
  categories: MenuCategory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: "",
    description: "",
    price: "",
    categoryId: String(categories[0]?.id ?? ""),
    image: "",
  });
  const [busy, setBusy] = React.useState(false);

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="center" className="max-w-md">
        <DialogHeader>
          <DialogTitle>New menu item</DialogTitle>
          <DialogDescription>
            It goes live on the storefront as soon as you save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 pb-4">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Focaccia al Rosmarino"
            />
          </Field>
          <Field label="Description">
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Rosemary, sea salt, Ligurian olive oil"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <Input
                value={form.price}
                inputMode="decimal"
                placeholder="7.50"
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <NativeSelect
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Image URL" hint="Optional — falls back to a colour card">
            <Input
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="https://images.unsplash.com/…"
            />
          </Field>
        </div>

        <div className="flex gap-2 border-t border-cream-400 p-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={busy || !form.name || !form.price}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await fetch("/api/admin/menu", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    entity: "item",
                    data: {
                      categoryId: Number(form.categoryId),
                      name: form.name,
                      description: form.description || null,
                      price: Number(form.price),
                      image: form.image || null,
                      allergens: [],
                    },
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  toast.error(data.error ?? "Couldn't create that item.");
                  return;
                }
                toast.success(`${form.name} added to the menu`);
                onClose();
                router.refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Create item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
