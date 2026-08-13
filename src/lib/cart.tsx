"use client";

import * as React from "react";
import { round2 } from "./utils";

export type CartModifier = {
  groupId: number;
  groupName: string;
  optionId: number;
  optionName: string;
  priceDelta: number;
};

export type CartItem = {
  /** Stable identity for a specific item+modifier+note combination. */
  key: string;
  menuItemId: number;
  name: string;
  image: string | null;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  note: string | null;
  modifiers: CartModifier[];
};

type CartState = {
  items: CartItem[];
  ready: boolean;
  add: (item: Omit<CartItem, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  /** Server-ready payload for /api/checkout/quote and /api/orders. */
  payload: () => {
    menuItemId: number;
    quantity: number;
    note: string | null;
    modifiers: Record<number, number[]>;
  }[];
};

const CartContext = React.createContext<CartState | null>(null);
const STORAGE_KEY = "bella-cucina-cart-v1";

export function cartKey(
  menuItemId: number,
  modifiers: CartModifier[],
  note: string | null,
) {
  const mods = modifiers
    .map((m) => m.optionId)
    .sort((a, b) => a - b)
    .join(".");
  return `${menuItemId}|${mods}|${note ?? ""}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [ready, setReady] = React.useState(false);

  // Hydrate from localStorage after mount so the SSR markup stays stable.
  // Reading storage during render would desync server and client HTML, so the
  // post-mount setState is deliberate here.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // Deliberate: syncing local state to a prop/storage change after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* corrupted payload — start fresh */
    }
    setReady(true);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* quota or private mode — the cart still works for this session */
    }
  }, [items, ready]);

  const add = React.useCallback((input: Omit<CartItem, "key">) => {
    const key = cartKey(input.menuItemId, input.modifiers, input.note);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + input.quantity } : i,
        );
      }
      return [...prev, { ...input, key }];
    });
  }, []);

  const setQuantity = React.useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.key !== key)
        : prev.map((i) => (i.key === key ? { ...i, quantity } : i)),
    );
  }, []);

  const remove = React.useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  const value = React.useMemo<CartState>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const subtotal = round2(
      items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    );
    return {
      items,
      ready,
      add,
      setQuantity,
      remove,
      clear,
      count,
      subtotal,
      payload: () =>
        items.map((i) => {
          const modifiers: Record<number, number[]> = {};
          for (const m of i.modifiers) {
            (modifiers[m.groupId] ??= []).push(m.optionId);
          }
          return {
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            note: i.note,
            modifiers,
          };
        }),
    };
  }, [items, ready, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
