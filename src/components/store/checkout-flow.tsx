"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Bike,
  Check,
  CreditCard,
  Gift,
  Loader2,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { DeliveryZone, RestaurantTable } from "@/db/schema";
import { useCart } from "@/lib/cart";
import { cn, money } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/data";
import {
  PaymentPicker,
  type PayMethod,
} from "@/components/store/payment-picker";

type QuoteResponse = {
  subtotal: number;
  discountAmount: number;
  appliedDiscounts: { kind: string; label: string; amount: number }[];
  serviceCharge: number;
  deliveryFee: number;
  taxAmount: number;
  tip: number;
  total: number;
  pointsEarned: number;
  earnRate: number;
  tier: { name: string; discountRate: number; freeDelivery: boolean } | null;
  voucher: { code: string; title: string } | null;
  voucherError: string | null;
  zone: DeliveryZone | null;
  warnings: string[];
  itemErrors: string[];
  signedIn: boolean;
  error?: string;
};

type OrderType = "dine_in" | "takeout" | "delivery";

const TYPES: { value: OrderType; label: string; icon: typeof Store; hint: string }[] = [
  { value: "dine_in", label: "Dine in", icon: UtensilsCrossed, hint: "Pick your table" },
  { value: "takeout", label: "Takeaway", icon: Store, hint: "Ready in ~15 min" },
  { value: "delivery", label: "Delivery", icon: Bike, hint: "To your door" },
];

function pickupSlots() {
  const out: string[] = [];
  const start = new Date(Date.now() + 20 * 60_000);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  for (let i = 0; i < 8; i++) {
    const t = new Date(start.getTime() + i * 15 * 60_000);
    out.push(
      `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
    );
  }
  return out;
}

export function CheckoutFlow({
  zones,
  tables,
  customer,
  suggestedVouchers,
}: {
  zones: DeliveryZone[];
  tables: RestaurantTable[];
  customer: { name: string; email: string; phone: string | null } | null;
  suggestedVouchers: { code: string; title: string; minSpend: number }[];
}) {
  const { items, payload, count, clear } = useCart();
  const router = useRouter();

  const [orderType, setOrderType] = React.useState<OrderType>("takeout");
  const [tableNumber, setTableNumber] = React.useState<number | null>(null);
  const [pickupSlot, setPickupSlot] = React.useState(() => pickupSlots()[0]);
  const [address, setAddress] = React.useState("");
  const [zoneId, setZoneId] = React.useState<number | null>(zones[0]?.id ?? null);

  const [name, setName] = React.useState(customer?.name ?? "");
  const [email, setEmail] = React.useState(customer?.email ?? "");
  const [phone, setPhone] = React.useState(customer?.phone ?? "");
  const [note, setNote] = React.useState("");

  const [voucherInput, setVoucherInput] = React.useState("");
  const [voucherCode, setVoucherCode] = React.useState<string | null>(null);
  const [tipPreset, setTipPreset] = React.useState<number | "custom">(0);
  const [customTip, setCustomTip] = React.useState("");

  // FPX leads because it carries most Malaysian online payments.
  const [paymentMethod, setPaymentMethod] =
    React.useState<PayMethod>("fpx");
  const [paymentDetail, setPaymentDetail] = React.useState("Maybank2u");
  const [cardNumber, setCardNumber] = React.useState("4242 4242 4242 4242");

  const [quote, setQuote] = React.useState<QuoteResponse | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [placing, setPlacing] = React.useState(false);

  const slots = React.useMemo(() => pickupSlots(), []);
  const lines = React.useMemo(() => payload(), [payload]);

  const tipAmount = React.useMemo(() => {
    if (tipPreset === "custom") return Math.max(0, Number(customTip) || 0);
    if (tipPreset === 0) return 0;
    const base = quote?.subtotal ?? 0;
    return Math.round(base * tipPreset * 100) / 100;
  }, [tipPreset, customTip, quote?.subtotal]);

  // Re-quote whenever anything that affects pricing changes.
  React.useEffect(() => {
    if (lines.length === 0) {
      // Deliberate: syncing local state to a prop/storage change after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote(null);
      return;
    }
    let cancelled = false;
    // Loading flag for an async fetch — the effect is the correct place for it.
    setQuoting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lines,
            orderType,
            zoneId: orderType === "delivery" ? zoneId : null,
            tip: tipAmount,
            voucherCode,
          }),
        });
        const data = (await res.json()) as QuoteResponse;
        if (!cancelled) setQuote(data);
      } catch {
        if (!cancelled) toast.error("Couldn't refresh your total. Try again.");
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lines, orderType, zoneId, tipAmount, voucherCode]);

  function applyVoucher(code?: string) {
    const next = (code ?? voucherInput).trim().toUpperCase();
    if (!next) return;
    setVoucherCode(next);
    setVoucherInput(next);
  }

  async function placeOrder() {
    if (!name.trim() || !email.trim()) {
      toast.error("Add your name and email so we can reach you.");
      return;
    }
    if (orderType === "dine_in" && !tableNumber) {
      toast.error("Pick a table first.");
      return;
    }
    if (orderType === "delivery" && address.trim().length < 6) {
      toast.error("Enter your delivery address.");
      return;
    }

    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines,
          orderType,
          zoneId: orderType === "delivery" ? zoneId : null,
          tip: tipAmount,
          voucherCode,
          tableNumber: orderType === "dine_in" ? tableNumber : null,
          address: orderType === "delivery" ? address : null,
          pickupSlot: orderType === "takeout" ? pickupSlot : null,
          paymentMethod,
          paymentDetail,
          guestName: name,
          guestEmail: email,
          guestPhone: phone || null,
          note: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "We couldn't place that order.");
        return;
      }
      clear();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      router.push(`/order/${data.orderId}?placed=1`);
    } catch {
      toast.error("Something went wrong placing your order.");
    } finally {
      setPlacing(false);
    }
  }

  if (count === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Add a few dishes and your checkout will appear here."
        action={
          <Button asChild>
            <Link href="/menu">Browse the menu</Link>
          </Button>
        }
        className="my-10"
      />
    );
  }

  const freeDeliveryFromTier = quote?.tier?.freeDelivery && orderType === "delivery";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5">
        {/* ------------------------------ step 1 ------------------------------ */}
        <Step n={1} title="How would you like it?">
          <div className="grid gap-2 sm:grid-cols-3">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setOrderType(t.value)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  orderType === t.value
                    ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600/20"
                    : "border-cream-400 bg-white hover:border-cream-500",
                )}
              >
                <t.icon
                  className={cn(
                    "size-5",
                    orderType === t.value ? "text-brand-700" : "text-ink-500",
                  )}
                />
                <p className="mt-2 text-sm font-semibold text-ink-900">
                  {t.label}
                </p>
                <p className="text-xs text-ink-500">{t.hint}</p>
              </button>
            ))}
          </div>

          {orderType === "dine_in" && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-ink-700">
                Choose your table
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {tables.map((t) => {
                  const busy = t.status === "occupied" || t.status === "reserved";
                  return (
                    <button
                      key={t.id}
                      disabled={busy}
                      onClick={() => setTableNumber(t.number)}
                      className={cn(
                        "rounded-xl border px-2 py-2.5 text-center transition",
                        tableNumber === t.number
                          ? "border-brand-600 bg-brand-700 text-white"
                          : busy
                            ? "cursor-not-allowed border-cream-400 bg-cream-200 text-ink-500/50"
                            : "border-cream-400 bg-white text-ink-900 hover:border-brand-300",
                      )}
                      title={busy ? `Table ${t.number} — ${t.status}` : undefined}
                    >
                      <span className="block text-sm font-semibold">
                        {t.number}
                      </span>
                      <span className="block text-[10px] opacity-70">
                        {t.seats} seats
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {orderType === "takeout" && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-ink-700">
                Collection time
              </p>
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPickupSlot(s)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                      pickupSlot === s
                        ? "border-brand-600 bg-brand-700 text-white"
                        : "border-cream-400 bg-white text-ink-700 hover:border-brand-300",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {orderType === "delivery" && (
            <div className="mt-4 space-y-3">
              <Field label="Delivery address" htmlFor="address">
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="42 Harbour Street, Apt 3B"
                />
              </Field>
              <div>
                <p className="mb-2 text-sm font-medium text-ink-700">
                  Delivery zone
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {zones.map((z) => (
                    <button
                      key={z.id}
                      onClick={() => setZoneId(z.id)}
                      className={cn(
                        "rounded-2xl border p-3.5 text-left transition",
                        zoneId === z.id
                          ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600/20"
                          : "border-cream-400 bg-white hover:border-cream-500",
                      )}
                    >
                      <p className="text-sm font-semibold text-ink-900">
                        {z.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {z.fee === 0 ? "Free delivery" : `${money(z.fee)} fee`} ·{" "}
                        {z.etaMinutes} min
                      </p>
                      <p className="text-xs text-ink-500">
                        Min order {money(z.minOrder)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Step>

        {/* ------------------------------ step 2 ------------------------------ */}
        <Step n={2} title="Your details">
          {customer ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              <Check className="size-4" />
              Signed in as {customer.email} — points will be credited
              automatically.
            </div>
          ) : (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-cream-400 bg-cream-100 px-3.5 py-2.5 text-sm text-ink-700">
              <Sparkles className="size-4 text-brand-700" />
              Checking out as a guest.
              <Link
                href="/login?next=/checkout"
                className="font-medium text-brand-700 underline underline-offset-2"
              >
                Sign in with your email
              </Link>
              to earn points on this order.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Moreau"
                autoComplete="name"
              />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Phone (optional)" htmlFor="phone">
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+60 12-345 6789"
                autoComplete="tel"
              />
            </Field>
            <Field label="Order note (optional)" htmlFor="note">
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ring the bell twice"
              />
            </Field>
          </div>

          {!customer && quote && quote.subtotal > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
              <Gift className="size-3.5 text-brand-700" />
              You&apos;d earn{" "}
              <strong className="text-ink-900">
                {Math.floor(quote.subtotal * 10).toLocaleString()} points
              </strong>{" "}
              on this order by signing in.
            </p>
          )}
        </Step>

        {/* ------------------------------ step 3 ------------------------------ */}
        <Step n={3} title="Vouchers & offers">
          <div className="flex gap-2">
            <Input
              value={voucherInput}
              onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
              placeholder="Enter a code"
              className="font-mono tracking-wider uppercase"
            />
            <Button variant="secondary" onClick={() => applyVoucher()}>
              Apply
            </Button>
          </div>

          {quote?.voucher && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              <Tag className="size-4" />
              <span className="flex-1">
                <strong>{quote.voucher.code}</strong> — {quote.voucher.title}
              </span>
              <button
                onClick={() => {
                  setVoucherCode(null);
                  setVoucherInput("");
                }}
                className="grid size-6 place-items-center rounded-full hover:bg-emerald-100"
                aria-label="Remove voucher"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {quote?.voucherError && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{quote.voucherError}</span>
            </div>
          )}

          {suggestedVouchers.length > 0 && !quote?.voucher && (
            <div className="mt-3">
              <p className="mb-2 text-xs text-ink-500">Available right now</p>
              <div className="flex flex-wrap gap-2">
                {suggestedVouchers.map((v) => (
                  <button
                    key={v.code}
                    onClick={() => applyVoucher(v.code)}
                    className="rounded-full border border-dashed border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
                  >
                    {v.code} · {v.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Step>

        {/* ------------------------------ step 4 ------------------------------ */}
        <Step n={4} title="Add a tip">
          <div className="flex flex-wrap gap-2">
            {[0, 0.1, 0.15, 0.2].map((p) => (
              <button
                key={p}
                onClick={() => setTipPreset(p)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  tipPreset === p
                    ? "border-brand-600 bg-brand-700 text-white"
                    : "border-cream-400 bg-white text-ink-700 hover:border-brand-300",
                )}
              >
                {p === 0 ? "No tip" : `${p * 100}%`}
              </button>
            ))}
            <button
              onClick={() => setTipPreset("custom")}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                tipPreset === "custom"
                  ? "border-brand-600 bg-brand-700 text-white"
                  : "border-cream-400 bg-white text-ink-700 hover:border-brand-300",
              )}
            >
              Custom
            </button>
            {tipPreset === "custom" && (
              <Input
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="w-28"
              />
            )}
          </div>
          <p className="mt-2 text-xs text-ink-500">
            100% of tips go to the floor and kitchen team. Tips don&apos;t earn
            loyalty points.
          </p>
        </Step>

        {/* ------------------------------ step 5 ------------------------------ */}
        <Step n={5} title="Payment">
          <PaymentPicker
            method={paymentMethod}
            onMethodChange={setPaymentMethod}
            detail={paymentDetail}
            onDetailChange={setPaymentDetail}
            cardNumber={cardNumber}
            onCardNumberChange={setCardNumber}
          />
        </Step>
      </div>

      {/* ------------------------------ summary ------------------------------ */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink-900">Order summary</h2>
            {quoting && <Loader2 className="size-4 animate-spin text-ink-500" />}
          </div>

          <ul className="mt-3 space-y-2 border-b border-cream-300 pb-3">
            {items.map((i) => (
              <li key={i.key} className="flex justify-between gap-3 text-sm">
                <span className="text-ink-700">
                  <span className="font-medium text-ink-900">{i.quantity}×</span>{" "}
                  {i.name}
                  {i.modifiers.length > 0 && (
                    <span className="block text-xs text-ink-500">
                      {i.modifiers.map((m) => m.optionName).join(", ")}
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-ink-700">
                  {money(i.unitPrice * i.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Subtotal" value={money(quote?.subtotal ?? 0)} />

            {quote?.appliedDiscounts.map((d, i) => (
              <Row
                key={i}
                label={d.label}
                value={`−${money(d.amount)}`}
                tone="discount"
              />
            ))}

            {(quote?.deliveryFee ?? 0) > 0 && (
              <Row label="Delivery" value={money(quote!.deliveryFee)} />
            )}
            {freeDeliveryFromTier && (
              <Row label="Delivery" value="Free · Gold" tone="discount" />
            )}
            <Row label="Service charge" value={money(quote?.serviceCharge ?? 0)} />
            <Row label="Tax" value={money(quote?.taxAmount ?? 0)} />
            {tipAmount > 0 && <Row label="Tip" value={money(tipAmount)} />}
          </dl>

          <div className="mt-3 flex items-end justify-between border-t border-cream-300 pt-3">
            <span className="text-sm font-medium text-ink-700">Total</span>
            <span className="font-display text-2xl text-ink-900">
              {money(quote?.total ?? 0)}
            </span>
          </div>

          {quote && quote.pointsEarned > 0 && (
            <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-gold-500/10 px-3 py-2 text-xs text-amber-900">
              <Sparkles className="size-3.5" />
              You&apos;ll earn{" "}
              <strong>{quote.pointsEarned.toLocaleString()} points</strong>
              {quote.tier ? ` at ${quote.earnRate} pts/$1 (${quote.tier.name})` : ""}
            </p>
          )}

          {quote?.warnings.map((w) => (
            <p
              key={w}
              className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {w}
            </p>
          ))}

          <Button
            size="xl"
            className="mt-4 w-full"
            onClick={placeOrder}
            disabled={placing || quoting || !quote}
          >
            {placing ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Placing order…
              </>
            ) : (
              <>
                <CreditCard className="size-4" /> Pay {money(quote?.total ?? 0)}
              </>
            )}
          </Button>

          <p className="mt-2 text-center text-[11px] text-ink-500">
            Demo checkout — test card 4242 4242 4242 4242
          </p>
        </div>
      </aside>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
          {n}
        </span>
        <h2 className="font-display text-lg text-ink-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "discount";
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={cn("text-ink-500", tone === "discount" && "text-emerald-700")}>
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums text-ink-700",
          tone === "discount" && "font-medium text-emerald-700",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
