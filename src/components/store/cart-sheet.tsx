"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
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
import { EmptyState } from "@/components/ui/data";
import { SafeImage } from "@/components/safe-image";

export function CartSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, subtotal, setQuantity, remove, clear, count } = useCart();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="sm:max-w-md">
        <DialogHeader className="border-b border-cream-400 pb-4">
          <DialogTitle>Your order</DialogTitle>
          <DialogDescription>
            {count === 0
              ? "Nothing here yet"
              : `${count} item${count === 1 ? "" : "s"} · ${money(subtotal)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Your cart is empty"
              description="Browse the menu and add something you'll enjoy."
              action={
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    router.push("/menu");
                  }}
                >
                  See the menu
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="flex gap-3 rounded-2xl border border-cream-400 bg-white p-3"
                >
                  <SafeImage
                    src={item.image}
                    alt={item.name}
                    wrapperClassName="size-16 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-snug font-medium text-ink-900">
                        {item.name}
                      </p>
                      <p className="text-sm font-semibold whitespace-nowrap text-ink-900">
                        {money(item.unitPrice * item.quantity)}
                      </p>
                    </div>

                    {item.modifiers.length > 0 && (
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                        {item.modifiers.map((m) => m.optionName).join(" · ")}
                      </p>
                    )}
                    {item.note && (
                      <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
                        “{item.note}”
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-1">
                      <button
                        onClick={() => setQuantity(item.key, item.quantity - 1)}
                        className="grid size-7 place-items-center rounded-full border border-cream-500 text-ink-700 transition hover:bg-cream-200"
                        aria-label={`Decrease ${item.name}`}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(item.key, item.quantity + 1)}
                        className="grid size-7 place-items-center rounded-full border border-cream-500 text-ink-700 transition hover:bg-cream-200"
                        aria-label={`Increase ${item.name}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <button
                        onClick={() => remove(item.key)}
                        className="ml-auto grid size-7 place-items-center rounded-full text-ink-500 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-cream-400 bg-white/80 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Subtotal</span>
              <span className="font-display text-xl text-ink-900">
                {money(subtotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Service charge, tax and any delivery fee are calculated at
              checkout.
            </p>
            <Button
              size="lg"
              className="mt-3 w-full"
              onClick={() => {
                onOpenChange(false);
                router.push("/checkout");
              }}
            >
              Go to checkout · {money(subtotal)}
            </Button>
            <button
              onClick={clear}
              className="mt-2 w-full text-xs font-medium text-ink-500 transition hover:text-red-600"
            >
              Clear cart
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
