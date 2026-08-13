"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Search,
  SplitSquareHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { MenuCategory, MenuItemWithMods } from "@/lib/menu";
import type { RestaurantTable } from "@/db/schema";
import { cn, money, round2 } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Line = {
  key: string;
  menuItemId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  modifiers: { groupId: number; optionId: number; optionName: string }[];
};

export function PosTerminal({
  categories,
  tables,
}: {
  categories: MenuCategory[];
  tables: RestaurantTable[];
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = React.useState(
    categories[0]?.name ?? "",
  );
  const [query, setQuery] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([]);
  const [orderType, setOrderType] = React.useState<
    "dine_in" | "takeout" | "delivery"
  >("dine_in");
  const [tableNumber, setTableNumber] = React.useState<number | null>(null);
  const [guestName, setGuestName] = React.useState("Walk-in");
  const [guestEmail, setGuestEmail] = React.useState("");
  const [voucherCode, setVoucherCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [splitOpen, setSplitOpen] = React.useState(false);
  const [configuring, setConfiguring] = React.useState<MenuItemWithMods | null>(
    null,
  );

  const visible = React.useMemo(() => {
    const all = categories.flatMap((c) => c.items);
    if (query.trim()) {
      const q = query.toLowerCase();
      return all.filter((i) => i.name.toLowerCase().includes(q));
    }
    return categories.find((c) => c.name === activeCategory)?.items ?? [];
  }, [categories, activeCategory, query]);

  const subtotal = round2(
    lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
  );
  const serviceCharge = round2(subtotal * 0.05);
  const tax = round2((subtotal + serviceCharge) * 0.08);
  const total = round2(subtotal + serviceCharge + tax);

  function addItem(item: MenuItemWithMods, chosen: Line["modifiers"] = []) {
    const key = `${item.id}|${chosen.map((m) => m.optionId).sort().join(".")}`;
    const delta = chosen.reduce((s, m) => {
      const group = item.groups.find((g) => g.id === m.groupId);
      const option = group?.options.find((o) => o.id === m.optionId);
      return s + (option?.priceDelta ?? 0);
    }, 0);

    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key,
          menuItemId: item.id,
          name: item.name,
          unitPrice: round2(item.price + delta),
          quantity: 1,
          modifiers: chosen,
        },
      ];
    });
  }

  function handleTap(item: MenuItemWithMods) {
    if (item.soldOut) {
      toast.error(`${item.name} is sold out.`);
      return;
    }
    // Required modifiers force the picker; everything else is one tap.
    if (item.groups.some((g) => g.required)) {
      setConfiguring(item);
      return;
    }
    addItem(item);
  }

  async function submit(paymentMethod: "card" | "cash" | "simulated") {
    if (lines.length === 0) {
      toast.error("The ticket is empty.");
      return;
    }
    if (orderType === "dine_in" && !tableNumber) {
      toast.error("Assign a table first.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/staff/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => {
            const modifiers: Record<number, number[]> = {};
            for (const m of l.modifiers) {
              (modifiers[m.groupId] ??= []).push(m.optionId);
            }
            return {
              menuItemId: l.menuItemId,
              quantity: l.quantity,
              note: null,
              modifiers,
            };
          }),
          orderType,
          tableNumber: orderType === "dine_in" ? tableNumber : null,
          voucherCode: voucherCode.trim() || null,
          paymentMethod,
          guestName: guestName || "Walk-in",
          guestEmail: guestEmail.trim() || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't send that order.");
        return;
      }
      toast.success(`${data.number} sent to the kitchen`);
      setLines([]);
      setVoucherCode("");
      setGuestEmail("");
      setTableNumber(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-[110rem] gap-4 px-4 py-6 lg:grid-cols-[1fr_24rem]">
      {/* ------------------------------ item grid --------------------------- */}
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="mr-auto font-display text-2xl">Point of sale</h1>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes"
              className="w-56 border-white/15 bg-white/5 pl-9 text-white placeholder:text-white/30"
            />
          </div>
        </div>

        {!query && (
          <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.name)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
                  activeCategory === c.name
                    ? "bg-white text-ink-900"
                    : "bg-white/10 text-white/70 hover:bg-white/15",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTap(item)}
              disabled={item.soldOut}
              className={cn(
                "flex min-h-24 flex-col justify-between rounded-2xl border p-3 text-left transition",
                item.soldOut
                  ? "cursor-not-allowed border-white/10 bg-white/5 opacity-40"
                  : "border-white/15 bg-white/8 hover:border-brand-400 hover:bg-white/15 active:scale-[.98]",
              )}
            >
              <span className="text-sm leading-snug font-medium">
                {item.name}
              </span>
              <span className="mt-2 flex items-center justify-between">
                <span className="font-display text-base text-brand-300">
                  {money(item.price)}
                </span>
                {item.soldOut ? (
                  <Badge variant="danger" className="border-transparent bg-red-500/20 text-red-300">
                    Sold out
                  </Badge>
                ) : item.groups.some((g) => g.required) ? (
                  <span className="text-[10px] text-white/40">options</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------- ticket ----------------------------- */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-white/15 bg-white/8 p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg">
              <Receipt className="size-4" /> Ticket
            </h2>
            {lines.length > 0 && (
              <button
                onClick={() => setLines([])}
                className="text-xs text-white/40 transition hover:text-red-300"
              >
                Clear
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {(
              [
                ["dine_in", "Dine in"],
                ["takeout", "Takeaway"],
                ["delivery", "Delivery"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setOrderType(value)}
                className={cn(
                  "rounded-lg py-2 text-xs font-medium transition",
                  orderType === value
                    ? "bg-brand-700 text-white"
                    : "bg-white/10 text-white/60 hover:bg-white/15",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {orderType === "dine_in" && (
            <NativeSelect
              value={tableNumber ?? ""}
              onChange={(e) =>
                setTableNumber(e.target.value ? Number(e.target.value) : null)
              }
              className="mt-2 border-white/15 bg-white/5 text-white"
            >
              <option value="">Assign a table…</option>
              {tables.map((t) => (
                <option key={t.id} value={t.number} className="text-ink-900">
                  Table {t.number} · {t.seats} seats · {t.status}
                </option>
              ))}
            </NativeSelect>
          )}

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name"
              className="border-white/15 bg-white/5 text-white placeholder:text-white/30"
            />
            <Input
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="Email (loyalty)"
              className="border-white/15 bg-white/5 text-white placeholder:text-white/30"
            />
          </div>

          <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
            {lines.length === 0 ? (
              <li className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-xs text-white/30">
                Tap a dish to start the ticket
              </li>
            ) : (
              lines.map((l) => (
                <li
                  key={l.key}
                  className="flex items-center gap-2 rounded-xl bg-white/8 px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{l.name}</p>
                    {l.modifiers.length > 0 && (
                      <p className="truncate text-[11px] text-white/45">
                        {l.modifiers.map((m) => m.optionName).join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-white/50">
                      {money(l.unitPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setLines((prev) =>
                          prev
                            .map((x) =>
                              x.key === l.key
                                ? { ...x, quantity: x.quantity - 1 }
                                : x,
                            )
                            .filter((x) => x.quantity > 0),
                        )
                      }
                      className="grid size-6 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                      aria-label="Decrease"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold tabular-nums">
                      {l.quantity}
                    </span>
                    <button
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === l.key
                              ? { ...x, quantity: x.quantity + 1 }
                              : x,
                          ),
                        )
                      }
                      className="grid size-6 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                      aria-label="Increase"
                    >
                      <Plus className="size-3" />
                    </button>
                    <button
                      onClick={() =>
                        setLines((prev) => prev.filter((x) => x.key !== l.key))
                      }
                      className="ml-1 grid size-6 place-items-center rounded-full text-white/40 hover:bg-red-500/20 hover:text-red-300"
                      aria-label="Remove"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>

          <Input
            value={voucherCode}
            onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
            placeholder="Voucher code"
            className="mt-3 border-white/15 bg-white/5 font-mono tracking-wider text-white uppercase placeholder:text-white/30 placeholder:normal-case"
          />

          <dl className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm">
            <Row label="Subtotal" value={money(subtotal)} />
            <Row label="Service 5%" value={money(serviceCharge)} />
            <Row label="Tax 8%" value={money(tax)} />
          </dl>
          <div className="mt-2 flex items-end justify-between border-t border-white/10 pt-2">
            <span className="text-sm text-white/60">Total</span>
            <span className="font-display text-2xl">{money(total)}</span>
          </div>
          {voucherCode && (
            <p className="mt-1 text-[11px] text-white/40">
              {voucherCode} is validated server-side when the ticket is sent.
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button disabled={busy} onClick={() => submit("card")}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CreditCard className="size-4" />
              )}
              Card
            </Button>
            <Button
              variant="success"
              disabled={busy}
              onClick={() => submit("cash")}
            >
              <Banknote className="size-4" /> Cash
            </Button>
          </div>

          <Button
            variant="ghost"
            className="mt-2 w-full text-white/60 hover:bg-white/10 hover:text-white"
            disabled={lines.length === 0}
            onClick={() => setSplitOpen(true)}
          >
            <SplitSquareHorizontal className="size-4" /> Split the bill
          </Button>
        </div>
      </aside>

      <ModifierPicker
        item={configuring}
        onClose={() => setConfiguring(null)}
        onConfirm={(item, chosen) => {
          addItem(item, chosen);
          setConfiguring(null);
        }}
      />

      <SplitBillDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        total={total}
        lines={lines}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-white/50">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function ModifierPicker({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItemWithMods | null;
  onClose: () => void;
  onConfirm: (
    item: MenuItemWithMods,
    chosen: { groupId: number; optionId: number; optionName: string }[],
  ) => void;
}) {
  const [selection, setSelection] = React.useState<Record<number, number[]>>({});

  // Seeds default modifier selections for the tapped item.
  React.useEffect(() => {
    if (!item) return;
    const initial: Record<number, number[]> = {};
    for (const g of item.groups) {
      const preset = g.options.find((o) => o.isDefault) ?? g.options[0];
      initial[g.id] = g.required && preset ? [preset.id] : [];
    }
    // Deliberate: syncing local state to a prop/storage change after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelection(initial);
  }, [item]);

  if (!item) return null;
  const dish = item;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="center" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dish.name}</DialogTitle>
          <DialogDescription>
            Required options must be set before this goes on the ticket.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 pb-4">
          {dish.groups.map((g) => (
            <div key={g.id}>
              <p className="mb-1.5 text-sm font-semibold text-ink-900">
                {g.name}
                {g.required && (
                  <span className="ml-1 text-xs text-brand-700">required</span>
                )}
              </p>
              <div className="grid gap-1.5">
                {g.options.map((o) => {
                  const picked = (selection[g.id] ?? []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() =>
                        setSelection((prev) => {
                          const cur = prev[g.id] ?? [];
                          if (g.selectionType === "single")
                            return { ...prev, [g.id]: [o.id] };
                          return {
                            ...prev,
                            [g.id]: cur.includes(o.id)
                              ? cur.filter((x) => x !== o.id)
                              : cur.length >= g.maxSelection
                                ? cur
                                : [...cur, o.id],
                          };
                        })
                      }
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition",
                        picked
                          ? "border-brand-600 bg-brand-50 text-brand-900"
                          : "border-cream-400 bg-white text-ink-700 hover:bg-cream-100",
                      )}
                    >
                      <span>{o.name}</span>
                      {o.priceDelta !== 0 && (
                        <span className="tabular-nums">
                          {o.priceDelta > 0 ? "+" : "−"}
                          {money(Math.abs(o.priceDelta))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-cream-400 p-4">
          <Button
            className="w-full"
            onClick={() => {
              const chosen = dish.groups.flatMap((g) =>
                (selection[g.id] ?? []).map((optionId) => ({
                  groupId: g.id,
                  optionId,
                  optionName:
                    g.options.find((o) => o.id === optionId)?.name ?? "",
                })),
              );
              const missing = dish.groups.find(
                (g) => g.required && (selection[g.id] ?? []).length === 0,
              );
              if (missing) {
                toast.error(`Choose an option for “${missing.name}”.`);
                return;
              }
              onConfirm(dish, chosen);
            }}
          >
            Add to ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SplitBillDialog({
  open,
  onOpenChange,
  total,
  lines,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  lines: Line[];
}) {
  const [mode, setMode] = React.useState<"evenly" | "by_item">("evenly");
  const [people, setPeople] = React.useState(2);
  const [assignments, setAssignments] = React.useState<Record<string, number>>({});

  const perHead = round2(total / Math.max(1, people));

  // By-item mode splits the fees proportionally to each guest's food value.
  const byItem = React.useMemo(() => {
    const buckets: Record<number, number> = {};
    let assigned = 0;
    for (const l of lines) {
      const guest = assignments[l.key] ?? 0;
      const value = l.unitPrice * l.quantity;
      buckets[guest] = (buckets[guest] ?? 0) + value;
      assigned += value;
    }
    const factor = assigned > 0 ? total / assigned : 0;
    return Object.entries(buckets).map(([guest, value]) => ({
      guest: Number(guest),
      amount: round2(value * factor),
    }));
  }, [lines, assignments, total]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="center" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Split the bill</DialogTitle>
          <DialogDescription>
            Total to split: {money(total)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["evenly", "Split evenly"],
                ["by_item", "Split by item"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                  mode === value
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-cream-400 bg-white text-ink-700",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "evenly" ? (
            <>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setPeople((p) => Math.max(2, p - 1))}
                  className="grid size-9 place-items-center rounded-full border border-cream-500"
                >
                  <Minus className="size-4" />
                </button>
                <span className="flex items-center gap-2 font-display text-2xl text-ink-900">
                  <Users className="size-5 text-ink-500" /> {people}
                </span>
                <button
                  onClick={() => setPeople((p) => Math.min(12, p + 1))}
                  className="grid size-9 place-items-center rounded-full border border-cream-500"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <div className="grid gap-1.5">
                {Array.from({ length: people }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-cream-100 px-3.5 py-2.5 text-sm"
                  >
                    <span className="text-ink-700">Guest {i + 1}</span>
                    <span className="font-semibold tabular-nums text-ink-900">
                      {money(
                        i === people - 1
                          ? round2(total - perHead * (people - 1))
                          : perHead,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-ink-500">
                Tap an item to move it between guests. Fees and tax follow each
                guest&apos;s share.
              </p>
              <div className="grid gap-1.5">
                {lines.map((l) => {
                  const guest = assignments[l.key] ?? 0;
                  return (
                    <button
                      key={l.key}
                      onClick={() =>
                        setAssignments((prev) => ({
                          ...prev,
                          [l.key]: ((prev[l.key] ?? 0) + 1) % 4,
                        }))
                      }
                      className="flex items-center justify-between rounded-xl border border-cream-400 bg-white px-3 py-2.5 text-sm"
                    >
                      <span className="text-ink-900">
                        {l.quantity}× {l.name}
                      </span>
                      <Badge variant="default">Guest {guest + 1}</Badge>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-1.5 border-t border-cream-300 pt-3">
                {byItem.map((b) => (
                  <div
                    key={b.guest}
                    className="flex items-center justify-between rounded-xl bg-cream-100 px-3.5 py-2.5 text-sm"
                  >
                    <span className="text-ink-700">Guest {b.guest + 1}</span>
                    <span className="font-semibold tabular-nums text-ink-900">
                      {money(b.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-cream-400 p-4">
          <Button
            className="w-full"
            onClick={() => {
              toast.success("Split recorded — take each payment on the terminal.");
              onOpenChange(false);
            }}
          >
            <X className="size-4" /> Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
