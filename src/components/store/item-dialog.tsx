"use client";

import * as React from "react";
import { Check, Minus, Plus, Timer } from "lucide-react";
import { toast } from "sonner";
import type { MenuItemWithMods } from "@/lib/menu";
import { useCart, type CartModifier } from "@/lib/cart";
import { cn, money, round2 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { SafeImage } from "@/components/safe-image";

type Selection = Record<number, number[]>;

function defaultSelection(item: MenuItemWithMods): Selection {
  const out: Selection = {};
  for (const g of item.groups) {
    const preset = g.options.filter((o) => o.isDefault).map((o) => o.id);
    out[g.id] = g.required && preset.length === 0 && g.options[0]
      ? [g.options[0].id]
      : preset;
  }
  return out;
}

export function ItemDialog({
  item,
  open,
  onOpenChange,
  onAdded,
}: {
  item: MenuItemWithMods | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (item: MenuItemWithMods) => void;
}) {
  const { add } = useCart();
  const [selection, setSelection] = React.useState<Selection>({});
  const [quantity, setQuantity] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [showErrors, setShowErrors] = React.useState(false);

  // Resets the picker when a different dish is opened.
  React.useEffect(() => {
    if (item && open) {
      // Deliberate: syncing local state to a prop/storage change after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelection(defaultSelection(item));
      setQuantity(1);
      setNote("");
      setShowErrors(false);
    }
  }, [item, open]);

  if (!item) return null;
  // Bind to a const so the narrowing survives inside the callbacks below.
  const dish = item;

  const chosenModifiers: CartModifier[] = item.groups.flatMap((g) =>
    (selection[g.id] ?? []).flatMap((optionId) => {
      const option = g.options.find((o) => o.id === optionId);
      if (!option) return [];
      return [
        {
          groupId: g.id,
          groupName: g.name,
          optionId: option.id,
          optionName: option.name,
          priceDelta: option.priceDelta,
        },
      ];
    }),
  );

  const unitPrice = round2(
    item.price + chosenModifiers.reduce((s, m) => s + m.priceDelta, 0),
  );

  const groupErrors = item.groups.reduce<Record<number, string>>((acc, g) => {
    const picked = selection[g.id] ?? [];
    const min = g.required ? Math.max(1, g.minSelection) : g.minSelection;
    if (picked.length < min) {
      acc[g.id] =
        min === 1 ? "Pick one option" : `Pick at least ${min} options`;
    } else if (picked.length > g.maxSelection) {
      acc[g.id] = `Pick at most ${g.maxSelection}`;
    }
    return acc;
  }, {});
  const isValid = Object.keys(groupErrors).length === 0;

  function toggle(groupId: number, optionId: number, single: boolean, max: number) {
    setSelection((prev) => {
      const current = prev[groupId] ?? [];
      if (single) return { ...prev, [groupId]: [optionId] };
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= max) {
        toast.info(`You can pick up to ${max} here.`);
        return prev;
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  function handleAdd() {
    if (!isValid) {
      setShowErrors(true);
      return;
    }
    add({
      menuItemId: dish.id,
      name: dish.name,
      image: dish.image,
      basePrice: dish.price,
      unitPrice,
      quantity,
      note: note.trim() || null,
      modifiers: chosenModifiers,
    });
    onOpenChange(false);
    onAdded?.(dish);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="bottom" className="sm:max-w-lg md:rounded-2xl">
        <div className="overflow-y-auto">
          <SafeImage
            src={item.image}
            alt={item.name}
            wrapperClassName="h-44 w-full shrink-0 sm:h-52"
            priority
          />

          <DialogHeader className="px-5 pt-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {item.featured && <Badge variant="gold">Popular</Badge>}
              <Badge variant="neutral">
                <Timer className="size-3" /> {item.prepMinutes} min
              </Badge>
              {(item.allergens ?? []).map((a) => (
                <Badge key={a} variant="outline" className="capitalize">
                  {a}
                </Badge>
              ))}
            </div>
            <DialogTitle className="mt-1">{item.name}</DialogTitle>
            <DialogDescription>{item.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-5 py-4">
            {item.groups.map((group) => {
              const single = group.selectionType === "single";
              const picked = selection[group.id] ?? [];
              const error = showErrors ? groupErrors[group.id] : undefined;

              return (
                <div key={group.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {group.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {group.required ? "Required · " : "Optional · "}
                        {single
                          ? "choose one"
                          : `choose up to ${group.maxSelection}`}
                      </p>
                    </div>
                    {error ? (
                      <Badge variant="danger">{error}</Badge>
                    ) : picked.length > 0 ? (
                      <Check className="size-4 text-emerald-600" />
                    ) : null}
                  </div>

                  <div className="grid gap-1.5">
                    {group.options.map((option) => {
                      const active = picked.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            toggle(group.id, option.id, single, group.maxSelection)
                          }
                          className={cn(
                            "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                            active
                              ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600/20"
                              : "border-cream-400 bg-white hover:border-cream-500 hover:bg-cream-100",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center border transition",
                              single ? "rounded-full" : "rounded-md",
                              active
                                ? "border-brand-700 bg-brand-700 text-white"
                                : "border-cream-500 bg-white",
                            )}
                          >
                            {active && <Check className="size-3" strokeWidth={3} />}
                          </span>
                          <span className="flex-1 text-sm text-ink-900">
                            {option.name}
                          </span>
                          {option.priceDelta !== 0 && (
                            <span
                              className={cn(
                                "text-sm font-medium tabular-nums",
                                option.priceDelta > 0
                                  ? "text-ink-700"
                                  : "text-emerald-700",
                              )}
                            >
                              {option.priceDelta > 0 ? "+" : "−"}
                              {money(Math.abs(option.priceDelta))}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div>
              <p className="mb-2 text-sm font-semibold text-ink-900">
                Special instructions
              </p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Allergies, spice level, how you'd like it plated…"
                maxLength={200}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-cream-400 bg-white/90 p-4">
          <div className="flex items-center gap-1 rounded-full border border-cream-500 p-1">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="grid size-8 place-items-center rounded-full text-ink-700 transition hover:bg-cream-200 disabled:opacity-40"
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-6 text-center text-sm font-semibold tabular-nums">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              className="grid size-8 place-items-center rounded-full text-ink-700 transition hover:bg-cream-200"
              aria-label="Increase quantity"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <Button size="lg" className="flex-1" onClick={handleAdd}>
            Add to cart · {money(unitPrice * quantity)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
