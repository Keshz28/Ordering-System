import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  category,
  customerVoucher,
  deliveryZone,
  loyaltyTier,
  menuItem,
  modifierGroup,
  modifierOption,
  promotion,
  settings as settingsTable,
  voucher as voucherTable,
  voucherRedemption,
  type Customer,
  type DeliveryZone,
  type LoyaltyTier,
  type OrderType,
  type Promotion,
  type ResolvedModifier,
  type Settings,
  type Voucher,
} from "@/db/schema";
import { isWithinTimeWindow, round2 } from "./utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type CartLine = {
  menuItemId: number;
  quantity: number;
  note?: string | null;
  /** groupId -> chosen optionIds */
  modifiers?: Record<string | number, number[]>;
};

export type ResolvedLine = {
  menuItemId: number;
  categoryId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note: string | null;
  resolvedModifiers: ResolvedModifier[];
  course: "starter" | "main" | "dessert" | "drink";
};

export type AppliedDiscount = {
  kind: "voucher" | "tier" | "promotion";
  code?: string;
  label: string;
  amount: number;
  voucherId?: number;
  promotionId?: number;
};

export type Quote = {
  lines: ResolvedLine[];
  subtotal: number;
  discountAmount: number;
  appliedDiscounts: AppliedDiscount[];
  serviceCharge: number;
  deliveryFee: number;
  taxAmount: number;
  tip: number;
  total: number;
  pointsEarned: number;
  earnRate: number;
  tier: LoyaltyTier | null;
  nextTier: LoyaltyTier | null;
  voucher: Voucher | null;
  voucherError: string | null;
  zone: DeliveryZone | null;
  /** Non-fatal notices, e.g. "minimum order for this zone is RM40". */
  warnings: string[];
  freeItemLine: ResolvedLine | null;
};

export type PricingContext = {
  settings: Settings;
  tiers: LoyaltyTier[];
  promotions: Promotion[];
};

/* -------------------------------------------------------------------------- */
/*  Context loaders                                                           */
/* -------------------------------------------------------------------------- */

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  restaurantName: "Bella Cucina",
  tagline: "Modern Italian, made to order",
  currency: "MYR",
  currencySymbol: "RM",
  serviceChargeRate: 0.1,
  taxRate: 0.06,
  taxLabel: "SST",
  address: "Jalan Telawi 3, Bangsar Baru, Kuala Lumpur",
  phone: "+60 3-2201 8845",
  openingHours: {},
  referralEnabled: true,
  referralValue: 10,
  pointsExpiryMonths: 18,
  reservationSlotMinutes: 30,
  reservationDurationMinutes: 90,
  reservationMaxPartySize: 12,
  reservationLeadDays: 60,
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settingsTable).limit(1);
  return rows[0] ?? DEFAULT_SETTINGS;
}

export async function getPricingContext(): Promise<PricingContext> {
  const [settings, tiers, promotions] = await Promise.all([
    getSettings(),
    db.select().from(loyaltyTier).orderBy(loyaltyTier.minPoints),
    db.select().from(promotion).where(eq(promotion.active, true)),
  ]);
  return { settings, tiers, promotions };
}

function courseFor(categoryName: string): ResolvedLine["course"] {
  const n = categoryName.toLowerCase();
  if (n.includes("starter") || n.includes("antipasti")) return "starter";
  if (n.includes("dessert") || n.includes("dolci")) return "dessert";
  if (n.includes("drink") || n.includes("bevande")) return "drink";
  return "main";
}

/* -------------------------------------------------------------------------- */
/*  Cart resolution — prices always come from the DB, never the client         */
/* -------------------------------------------------------------------------- */

export async function resolveCart(
  lines: CartLine[],
): Promise<{ lines: ResolvedLine[]; errors: string[] }> {
  const errors: string[] = [];
  const clean = lines.filter((l) => l.menuItemId && l.quantity > 0);
  if (clean.length === 0) return { lines: [], errors: ["Your cart is empty."] };

  const ids = [...new Set(clean.map((l) => l.menuItemId))];
  const items = await db
    .select({ item: menuItem, categoryName: category.name })
    .from(menuItem)
    .innerJoin(category, eq(menuItem.categoryId, category.id))
    .where(inArray(menuItem.id, ids));

  const groups = await db
    .select()
    .from(modifierGroup)
    .where(inArray(modifierGroup.menuItemId, ids));

  const options = groups.length
    ? await db
        .select()
        .from(modifierOption)
        .where(
          inArray(
            modifierOption.groupId,
            groups.map((g) => g.id),
          ),
        )
    : [];

  const itemById = new Map(items.map((r) => [r.item.id, r]));
  const optionById = new Map(options.map((o) => [o.id, o]));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const resolved: ResolvedLine[] = [];

  for (const line of clean) {
    const record = itemById.get(line.menuItemId);
    if (!record) {
      errors.push(`An item in your cart is no longer on the menu.`);
      continue;
    }
    const { item } = record;

    if (!item.isAvailable) {
      errors.push(`${item.name} is currently unavailable.`);
      continue;
    }
    if (item.stock !== null && item.stock <= 0) {
      errors.push(`${item.name} is sold out.`);
      continue;
    }
    if (item.stock !== null && item.stock < line.quantity) {
      errors.push(`Only ${item.stock} × ${item.name} left.`);
      continue;
    }
    if (!isWithinTimeWindow(item.availableFrom, item.availableTo)) {
      errors.push(
        `${item.name} is only available ${item.availableFrom}–${item.availableTo}.`,
      );
      continue;
    }

    const chosen = line.modifiers ?? {};
    const itemGroups = groups.filter((g) => g.menuItemId === item.id);
    const resolvedModifiers: ResolvedModifier[] = [];
    let delta = 0;
    let lineInvalid = false;

    for (const group of itemGroups) {
      const picked = (chosen[group.id] ?? chosen[String(group.id)] ?? []).filter(
        (id) => optionById.get(id)?.groupId === group.id,
      );

      if (group.required && picked.length < Math.max(1, group.minSelection)) {
        errors.push(`${item.name}: choose an option for “${group.name}”.`);
        lineInvalid = true;
        continue;
      }
      if (picked.length > group.maxSelection) {
        errors.push(
          `${item.name}: pick at most ${group.maxSelection} from “${group.name}”.`,
        );
        lineInvalid = true;
        continue;
      }
      if (group.selectionType === "single" && picked.length > 1) {
        errors.push(`${item.name}: only one “${group.name}” may be selected.`);
        lineInvalid = true;
        continue;
      }

      for (const optionId of picked) {
        const option = optionById.get(optionId)!;
        delta += option.priceDelta;
        resolvedModifiers.push({
          groupId: group.id,
          groupName: groupById.get(group.id)?.name ?? "",
          optionId: option.id,
          optionName: option.name,
          priceDelta: option.priceDelta,
        });
      }
    }

    if (lineInvalid) continue;

    const unitPrice = round2(item.price + delta);
    resolved.push({
      menuItemId: item.id,
      categoryId: item.categoryId,
      name: item.name,
      quantity: line.quantity,
      unitPrice,
      lineTotal: round2(unitPrice * line.quantity),
      note: line.note?.trim() || null,
      resolvedModifiers,
      course: courseFor(record.categoryName),
    });
  }

  return { lines: resolved, errors };
}

/* -------------------------------------------------------------------------- */
/*  Voucher validation                                                        */
/* -------------------------------------------------------------------------- */

export type VoucherCheck =
  | { ok: true; voucher: Voucher; discount: number; freeItemId?: number | null }
  | { ok: false; reason: string; voucher?: Voucher };

export async function validateVoucher(opts: {
  code: string;
  lines: ResolvedLine[];
  subtotal: number;
  orderType: OrderType;
  deliveryFee: number;
  customerId?: number | null;
  email?: string | null;
  now?: Date;
}): Promise<VoucherCheck> {
  const now = opts.now ?? new Date();
  const code = opts.code.trim().toUpperCase();
  if (!code) return { ok: false, reason: "Enter a voucher code." };

  const rows = await db
    .select()
    .from(voucherTable)
    .where(eq(voucherTable.code, code));
  const v = rows[0];

  if (!v) return { ok: false, reason: `“${code}” is not a valid code.` };
  if (!v.active)
    return { ok: false, reason: "This voucher is no longer active.", voucher: v };
  if (v.validFrom && now < v.validFrom)
    return {
      ok: false,
      reason: `This voucher starts on ${v.validFrom.toLocaleDateString()}.`,
      voucher: v,
    };
  if (v.validTo && now > v.validTo)
    return { ok: false, reason: "This voucher has expired.", voucher: v };

  const types = v.orderTypes ?? [];
  if (types.length && !types.includes(opts.orderType)) {
    const label: Record<OrderType, string> = {
      dine_in: "dine-in",
      takeout: "takeaway",
      delivery: "delivery",
    };
    return {
      ok: false,
      reason: `Valid on ${types.map((t) => label[t]).join(", ")} orders only.`,
      voucher: v,
    };
  }

  if (opts.subtotal < v.minSpend) {
    return {
      ok: false,
      reason: `Spend $${v.minSpend.toFixed(2)} to use this voucher (you're at $${opts.subtotal.toFixed(2)}).`,
      voucher: v,
    };
  }

  if (v.usageLimit !== null && v.usesCount >= v.usageLimit) {
    return {
      ok: false,
      reason: "This voucher has reached its usage limit.",
      voucher: v,
    };
  }

  // Targeted vouchers are only usable by a customer they were issued to.
  if (v.targeted) {
    if (!opts.customerId) {
      return {
        ok: false,
        reason: "Sign in with the email this offer was sent to.",
        voucher: v,
      };
    }
    const issued = await db
      .select()
      .from(customerVoucher)
      .where(
        and(
          eq(customerVoucher.voucherId, v.id),
          eq(customerVoucher.customerId, opts.customerId),
        ),
      );
    const usable = issued.find(
      (i) => !i.redeemedAt && (!i.expiresAt || i.expiresAt > now),
    );
    if (!usable) {
      return {
        ok: false,
        reason: issued.length
          ? "You've already used this offer."
          : "This offer isn't available on your account.",
        voucher: v,
      };
    }
  }

  if (v.perCustomerLimit !== null && (opts.customerId || opts.email)) {
    const prior = await db
      .select()
      .from(voucherRedemption)
      .where(
        and(
          eq(voucherRedemption.voucherId, v.id),
          opts.customerId
            ? eq(voucherRedemption.customerId, opts.customerId)
            : eq(voucherRedemption.email, opts.email!),
        ),
      );
    if (prior.length >= v.perCustomerLimit) {
      return {
        ok: false,
        reason:
          v.perCustomerLimit === 1
            ? "You've already used this voucher."
            : `Limit ${v.perCustomerLimit} uses per customer reached.`,
        voucher: v,
      };
    }
  }

  // ----- compute the discount -----
  const scoped = scopedSubtotal(v, opts.lines);

  if (v.type === "percent_off") {
    if (scoped <= 0)
      return {
        ok: false,
        reason: "No items in your cart qualify for this voucher.",
        voucher: v,
      };
    return { ok: true, voucher: v, discount: round2(scoped * (v.value / 100)) };
  }

  if (v.type === "fixed_off") {
    return { ok: true, voucher: v, discount: round2(Math.min(v.value, scoped)) };
  }

  if (v.type === "free_delivery") {
    if (opts.orderType !== "delivery")
      return {
        ok: false,
        reason: "Free delivery applies to delivery orders only.",
        voucher: v,
      };
    return { ok: true, voucher: v, discount: round2(opts.deliveryFee) };
  }

  // free_item
  const target = opts.lines.find((l) => l.menuItemId === v.freeItemId);
  if (!target) {
    const name = v.freeItemId
      ? ((
          await db
            .select({ name: menuItem.name })
            .from(menuItem)
            .where(eq(menuItem.id, v.freeItemId))
        )[0]?.name ?? "the gift item")
      : "the gift item";
    return {
      ok: false,
      reason: `Add ${name} to your cart to claim this offer.`,
      voucher: v,
    };
  }
  return {
    ok: true,
    voucher: v,
    discount: round2(target.unitPrice),
    freeItemId: v.freeItemId,
  };
}

/** Subtotal restricted to the voucher's applicable items/categories. */
function scopedSubtotal(v: Voucher, lines: ResolvedLine[]) {
  const items = v.applicableItems;
  const cats = v.applicableCategories;
  if ((!items || items.length === 0) && (!cats || cats.length === 0)) {
    return round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  }
  return round2(
    lines
      .filter(
        (l) =>
          (items?.includes(l.menuItemId) ?? false) ||
          (cats?.includes(l.categoryId) ?? false),
      )
      .reduce((s, l) => s + l.lineTotal, 0),
  );
}

/* -------------------------------------------------------------------------- */
/*  Automatic promotions                                                      */
/* -------------------------------------------------------------------------- */

function autoPromotionDiscounts(
  ctx: PricingContext,
  lines: ResolvedLine[],
  subtotal: number,
  cust: Customer | null,
  isFirstOrder: boolean,
  now: Date,
): AppliedDiscount[] {
  const out: AppliedDiscount[] = [];

  for (const p of ctx.promotions) {
    const cfg = p.config ?? {};

    if (p.type === "first_order" && isFirstOrder && cfg.percentOff) {
      out.push({
        kind: "promotion",
        promotionId: p.id,
        label: `${p.title} (${cfg.percentOff}% off)`,
        amount: round2(subtotal * (cfg.percentOff / 100)),
      });
    }

    if (p.type === "happy_hour" && cfg.percentOff) {
      const days = cfg.days ?? [1, 2, 3, 4, 5];
      const inDay = days.includes(now.getDay());
      const inWindow = isWithinTimeWindow(
        cfg.startTime ?? null,
        cfg.endTime ?? null,
        now,
      );
      if (inDay && inWindow) {
        out.push({
          kind: "promotion",
          promotionId: p.id,
          label: `${p.title} (${cfg.percentOff}% off)`,
          amount: round2(subtotal * (cfg.percentOff / 100)),
        });
      }
    }

    if (p.type === "bogo" && cfg.buyItemId && cfg.getItemId) {
      const buy = lines.find((l) => l.menuItemId === cfg.buyItemId);
      const get = lines.find((l) => l.menuItemId === cfg.getItemId);
      if (buy && get) {
        const free = Math.min(buy.quantity, get.quantity);
        if (free > 0) {
          out.push({
            kind: "promotion",
            promotionId: p.id,
            label: p.title,
            amount: round2(get.unitPrice * free),
          });
        }
      }
    }

    if (p.type === "bundle" && cfg.itemIds?.length && cfg.bundlePrice) {
      const present = cfg.itemIds.every((id) =>
        lines.some((l) => l.menuItemId === id),
      );
      if (present) {
        const listPrice = cfg.itemIds.reduce(
          (s, id) => s + (lines.find((l) => l.menuItemId === id)?.unitPrice ?? 0),
          0,
        );
        const saving = round2(listPrice - cfg.bundlePrice);
        if (saving > 0) {
          out.push({
            kind: "promotion",
            promotionId: p.id,
            label: `${p.title} bundle`,
            amount: saving,
          });
        }
      }
    }

    if (p.type === "birthday" && cust?.birthday && cfg.fixedOff) {
      const [, m, d] = cust.birthday.split("-").map(Number);
      const bday = new Date(now.getFullYear(), (m || 1) - 1, d || 1);
      const window = cfg.daysBefore ?? 7;
      const diffDays = Math.abs(
        Math.round((bday.getTime() - now.getTime()) / 86_400_000),
      );
      if (diffDays <= window) {
        out.push({
          kind: "promotion",
          promotionId: p.id,
          label: `${p.title} ($${cfg.fixedOff} off)`,
          amount: round2(Math.min(cfg.fixedOff, subtotal)),
        });
      }
    }
  }

  // Only the single best automatic promotion applies — they never stack.
  if (out.length <= 1) return out;
  return [out.reduce((best, cur) => (cur.amount > best.amount ? cur : best))];
}

/* -------------------------------------------------------------------------- */
/*  Loyalty tier helpers                                                      */
/* -------------------------------------------------------------------------- */

export function tierFor(tiers: LoyaltyTier[], points: number) {
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  let current: LoyaltyTier | null = sorted[0] ?? null;
  for (const t of sorted) if (points >= t.minPoints) current = t;
  return current;
}

export function nextTierFor(tiers: LoyaltyTier[], points: number) {
  return (
    [...tiers]
      .sort((a, b) => a.minPoints - b.minPoints)
      .find((t) => t.minPoints > points) ?? null
  );
}

/* -------------------------------------------------------------------------- */
/*  The quote                                                                 */
/* -------------------------------------------------------------------------- */

export async function quoteOrder(opts: {
  lines: ResolvedLine[];
  orderType: OrderType;
  zoneId?: number | null;
  tip?: number;
  voucherCode?: string | null;
  customer?: Customer | null;
  isFirstOrder?: boolean;
  ctx?: PricingContext;
  now?: Date;
}): Promise<Quote> {
  const ctx = opts.ctx ?? (await getPricingContext());
  const now = opts.now ?? new Date();
  const { settings, tiers } = ctx;
  const lines = opts.lines;
  const warnings: string[] = [];

  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));

  // --- delivery ------------------------------------------------------------
  let zone: DeliveryZone | null = null;
  let deliveryFee = 0;
  if (opts.orderType === "delivery" && opts.zoneId) {
    const rows = await db
      .select()
      .from(deliveryZone)
      .where(eq(deliveryZone.id, opts.zoneId));
    zone = rows[0] ?? null;
    if (zone) {
      deliveryFee = zone.fee;
      if (subtotal < zone.minOrder) {
        warnings.push(
          `${zone.name} has a $${zone.minOrder.toFixed(2)} minimum — add $${(
            zone.minOrder - subtotal
          ).toFixed(2)} more.`,
        );
      }
    }
  }

  // --- tier ----------------------------------------------------------------
  const points = opts.customer?.tierPoints ?? 0;
  const tier = opts.customer ? tierFor(tiers, points) : null;
  const nextTier = opts.customer ? nextTierFor(tiers, points) : null;
  if (tier?.freeDelivery) deliveryFee = 0;

  const appliedDiscounts: AppliedDiscount[] = [];

  // --- manual voucher ------------------------------------------------------
  let voucher: Voucher | null = null;
  let voucherError: string | null = null;
  let freeItemLine: ResolvedLine | null = null;

  if (opts.voucherCode) {
    const check = await validateVoucher({
      code: opts.voucherCode,
      lines,
      subtotal,
      orderType: opts.orderType,
      deliveryFee,
      customerId: opts.customer?.id ?? null,
      email: opts.customer?.email ?? null,
      now,
    });
    if (check.ok) {
      voucher = check.voucher;
      appliedDiscounts.push({
        kind: "voucher",
        code: check.voucher.code,
        voucherId: check.voucher.id,
        label: check.voucher.title,
        amount: check.discount,
      });
      if (check.voucher.type === "free_delivery") deliveryFee = 0;
      if (check.voucher.type === "free_item" && check.freeItemId) {
        freeItemLine =
          lines.find((l) => l.menuItemId === check.freeItemId) ?? null;
      }
    } else {
      voucherError = check.reason;
    }
  }

  // --- automatic promotions ------------------------------------------------
  // Stacking rule: one manual voucher + the tier discount. Auto-promotions only
  // apply when no manual voucher is in play (unless the voucher is stackable).
  if (!voucher || voucher.stackable) {
    appliedDiscounts.push(
      ...autoPromotionDiscounts(
        ctx,
        lines,
        subtotal,
        opts.customer ?? null,
        opts.isFirstOrder ?? (opts.customer?.orderCount ?? 0) === 0,
        now,
      ),
    );
  }

  // --- tier discount (always stacks) ---------------------------------------
  if (tier && tier.discountRate > 0) {
    appliedDiscounts.push({
      kind: "tier",
      label: `${tier.name} member ${Math.round(tier.discountRate * 100)}% off`,
      amount: round2(subtotal * tier.discountRate),
    });
  }

  const rawDiscount = round2(
    appliedDiscounts.reduce((s, d) => s + d.amount, 0),
  );
  const discountAmount = round2(Math.min(rawDiscount, subtotal));

  // --- fees & tax ----------------------------------------------------------
  const discountedFood = round2(subtotal - discountAmount);
  const serviceCharge = round2(discountedFood * settings.serviceChargeRate);
  const taxable = round2(discountedFood + serviceCharge + deliveryFee);
  const taxAmount = round2(taxable * settings.taxRate);
  const tip = round2(opts.tip ?? 0);
  const total = round2(taxable + taxAmount + tip);

  // --- loyalty -------------------------------------------------------------
  // Anti-gaming: points accrue on post-discount food only. No fees, no tip.
  const earnRate = tier?.earnRate ?? tiers[0]?.earnRate ?? 10;
  const pointsEarned = opts.customer
    ? Math.floor(discountedFood * earnRate)
    : 0;

  return {
    lines,
    subtotal,
    discountAmount,
    appliedDiscounts,
    serviceCharge,
    deliveryFee: round2(deliveryFee),
    taxAmount,
    tip,
    total,
    pointsEarned,
    earnRate,
    tier,
    nextTier,
    voucher,
    voucherError,
    zone,
    warnings,
    freeItemLine,
  };
}
