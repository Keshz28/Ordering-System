"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useCart, type CartModifier } from "@/lib/cart";
import { Button } from "@/components/ui/button";

/**
 * One-tap reorder. Rebuilds the cart from the historical order lines, keeping
 * the modifier selections and notes intact, then sends you to checkout.
 */
export function ReorderButton({
  lines,
}: {
  lines: {
    menuItemId: number;
    name: string;
    unitPrice: number;
    quantity: number;
    note: string | null;
    modifiers: CartModifier[];
  }[];
}) {
  const { add, clear } = useCart();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const valid = lines.filter((l) => l.menuItemId);
        if (valid.length === 0) {
          toast.error("Those dishes are no longer on the menu.");
          return;
        }
        clear();
        for (const l of valid) {
          add({
            menuItemId: l.menuItemId,
            name: l.name,
            image: null,
            basePrice: l.unitPrice,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            note: l.note,
            modifiers: l.modifiers,
          });
        }
        toast.success(`${valid.length} items back in your cart`);
        router.push("/checkout");
      }}
    >
      <RotateCcw className="size-3.5" /> Reorder
    </Button>
  );
}
