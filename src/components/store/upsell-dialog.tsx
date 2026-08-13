"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { MenuItem } from "@/db/schema";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SafeImage } from "@/components/safe-image";

/**
 * Fires once after something lands in the cart. Suggestions exclude whatever
 * was just added so it never proposes the same dish back.
 */
export function UpsellDialog({
  trigger,
  suggestions,
  onOpenChange,
}: {
  trigger: { id: number; name: string } | null;
  suggestions: MenuItem[];
  onOpenChange: (open: boolean) => void;
}) {
  const { add, items } = useCart();
  const inCart = new Set(items.map((i) => i.menuItemId));
  const options = suggestions
    .filter((s) => s.id !== trigger?.id && !inCart.has(s.id))
    .slice(0, 3);

  const open = Boolean(trigger) && options.length > 0;

  React.useEffect(() => {
    if (trigger && options.length === 0) onOpenChange(false);
  }, [trigger, options.length, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="bottom" className="sm:max-w-md md:rounded-2xl">
        <DialogHeader className="px-5 pt-5">
          <div className="flex size-10 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
            <Sparkles className="size-5" />
          </div>
          <DialogTitle className="mt-2">Complete your meal</DialogTitle>
          <DialogDescription>
            {trigger?.name} pairs beautifully with these.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-5 py-4">
          {options.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-2xl border border-cream-400 bg-white p-2.5"
            >
              <SafeImage
                src={s.image}
                alt={s.name}
                wrapperClassName="size-14 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">
                  {s.name}
                </p>
                <p className="text-xs text-ink-500">{money(s.price)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  add({
                    menuItemId: s.id,
                    name: s.name,
                    image: s.image,
                    basePrice: s.price,
                    unitPrice: s.price,
                    quantity: 1,
                    note: null,
                    modifiers: [],
                  });
                  toast.success(`${s.name} added`);
                  onOpenChange(false);
                }}
              >
                Add {money(s.price)}
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t border-cream-400 p-4">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            No thanks, continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
