import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { eq } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import {
  CATEGORIES,
  CUSTOMERS,
  ITEMS,
  MODIFIER_TEMPLATES,
  OPENING_HOURS,
  REDEMPTIONS,
  REVIEW_COMMENTS,
  STAFF,
  TABLES,
  TIERS,
  ZONES,
  type SeedItem,
} from "./seed-data";
import { hashPassword } from "@/lib/auth";
import { mulberry32, round2 } from "@/lib/utils";

const rnd = mulberry32(20260812);
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const between = (min: number, max: number) =>
  min + Math.floor(rnd() * (max - min + 1));
const chance = (p: number) => rnd() < p;
const DAY = 86_400_000;

function weightedPick<T>(items: { item: T; weight: number }[]) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rnd() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i.item;
  }
  return items[items.length - 1].item;
}

async function chunkInsert<T extends Record<string, unknown>>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  size = 40,
) {
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + size) as any);
  }
}

/* -------------------------------------------------------------------------- */

async function wipe() {
  // Children before parents — FKs are enforced by libSQL.
  await db.delete(s.campaignRecipient);
  await db.delete(s.notification);
  await db.delete(s.pointsLedger);
  await db.delete(s.voucherRedemption);
  await db.delete(s.customerVoucher);
  await db.delete(s.review);
  await db.delete(s.favorite);
  await db.delete(s.orderItem);
  await db.update(s.restaurantTable).set({ currentOrderId: null });
  await db.delete(s.order);
  await db.delete(s.campaign);
  await db.delete(s.loyaltyRedemption);
  await db.delete(s.modifierOption);
  await db.delete(s.modifierGroup);
  await db.delete(s.voucher);
  await db.delete(s.menuItem);
  await db.delete(s.category);
  await db.delete(s.promotion);
  await db.delete(s.loyaltyTier);
  await db.delete(s.deliveryZone);
  await db.delete(s.restaurantTable);
  await db.delete(s.loginToken);
  await db.delete(s.staffActivityLog);
  await db.delete(s.customer);
  await db.delete(s.user);
  await db.delete(s.settings);
}

/* -------------------------------------------------------------------------- */

export async function seed() {
  const started = Date.now();
  console.log("→ clearing existing data");
  await wipe();

  /* ------------------------------- settings ------------------------------- */
  await db.insert(s.settings).values({
    id: 1,
    restaurantName: "Bella Cucina",
    tagline: "Wood-fired Italian, made to order",
    currency: "USD",
    currencySymbol: "$",
    serviceChargeRate: 0.05,
    taxRate: 0.08,
    address: "118 Vine Street, Riverside District",
    phone: "(555) 018-2245",
    openingHours: OPENING_HOURS,
    referralEnabled: true,
    referralValue: 10,
    pointsExpiryMonths: 18,
  });

  /* ------------------------------ menu ------------------------------------ */
  console.log("→ menu");
  const categoryIds = new Map<string, number>();
  for (const [i, c] of CATEGORIES.entries()) {
    const [row] = await db
      .insert(s.category)
      .values({ ...c, sortOrder: i, active: true })
      .returning();
    categoryIds.set(c.name, row.id);
  }

  const itemIds = new Map<string, number>();
  const itemMeta = new Map<number, SeedItem>();
  for (const [i, item] of ITEMS.entries()) {
    const [row] = await db
      .insert(s.menuItem)
      .values({
        categoryId: categoryIds.get(item.category)!,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        allergens: item.allergens,
        prepMinutes: item.prepMinutes,
        isAvailable: true,
        availableFrom: item.availableFrom ?? null,
        availableTo: item.availableTo ?? null,
        featured: item.featured ?? false,
        stock: item.stock ?? null,
        sortOrder: i,
      })
      .returning();
    itemIds.set(item.name, row.id);
    itemMeta.set(row.id, item);

    for (const [gi, key] of (item.modifiers ?? []).entries()) {
      const template = MODIFIER_TEMPLATES[key];
      const [group] = await db
        .insert(s.modifierGroup)
        .values({
          menuItemId: row.id,
          name: template.name,
          selectionType: template.selectionType,
          required: template.required,
          minSelection: template.minSelection,
          maxSelection: template.maxSelection,
          sortOrder: gi,
        })
        .returning();
      await chunkInsert(
        s.modifierOption,
        template.options.map((o, oi) => ({
          groupId: group.id,
          name: o.name,
          priceDelta: o.priceDelta,
          isDefault: "isDefault" in o ? Boolean(o.isDefault) : false,
          sortOrder: oi,
        })),
      );
    }
  }

  /* --------------------------- zones, tables, tiers ----------------------- */
  console.log("→ operations");
  const zoneIds: number[] = [];
  for (const z of ZONES) {
    const [row] = await db.insert(s.deliveryZone).values(z).returning();
    zoneIds.push(row.id);
  }

  await chunkInsert(
    s.restaurantTable,
    TABLES.map((t) => ({
      ...t,
      status: chance(0.3)
        ? ("occupied" as const)
        : chance(0.15)
          ? ("reserved" as const)
          : ("free" as const),
    })),
  );

  const tierIds: number[] = [];
  for (const [i, t] of TIERS.entries()) {
    const [row] = await db
      .insert(s.loyaltyTier)
      .values({ ...t, sortOrder: i })
      .returning();
    tierIds.push(row.id);
  }

  await chunkInsert(
    s.loyaltyRedemption,
    REDEMPTIONS.map((r) => ({
      name: r.name,
      description: r.description,
      pointsCost: r.pointsCost,
      rewardType: r.rewardType,
      rewardValue: r.rewardValue,
      freeItemId:
        "freeItemName" in r && r.freeItemName
          ? (itemIds.get(r.freeItemName) ?? null)
          : null,
      minSpend: r.minSpend,
      validDays: r.validDays,
      active: true,
    })),
  );

  /* -------------------------------- staff --------------------------------- */
  const passwordHash = hashPassword("demo1234");
  const staffIds: number[] = [];
  for (const person of STAFF) {
    const [row] = await db
      .insert(s.user)
      .values({ ...person, passwordHash, active: true })
      .returning();
    staffIds.push(row.id);
  }

  /* ------------------------------- vouchers ------------------------------- */
  console.log("→ vouchers & promotions");
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * DAY);
  const ago30 = new Date(now.getTime() - 30 * DAY);

  const voucherIds = new Map<string, number>();
  const voucherSeeds = [
    {
      code: "BELLA15",
      title: "15% off your order",
      description: "Our house-wide welcome discount on orders over $30.",
      type: "percent_off" as const,
      value: 15,
      minSpend: 30,
      usageLimit: null,
      perCustomerLimit: 3,
      stackable: false,
    },
    {
      code: "FIRSTTASTE",
      title: "First order — 15% off",
      description: "One-time welcome offer for brand new guests.",
      type: "percent_off" as const,
      value: 15,
      minSpend: 0,
      usageLimit: null,
      perCustomerLimit: 1,
      stackable: false,
    },
    {
      code: "GARLICFREE",
      title: "Free Garlic Bread al Forno",
      description: "Add garlic bread to your cart and it's on the house.",
      type: "free_item" as const,
      value: 0,
      minSpend: 20,
      usageLimit: 500,
      perCustomerLimit: 2,
      stackable: true,
      freeItemId: itemIds.get("Garlic Bread al Forno")!,
    },
    {
      code: "FREEDELIV",
      title: "Free delivery over $25",
      description: "We cover the delivery fee on orders above $25.",
      type: "free_delivery" as const,
      value: 0,
      minSpend: 25,
      usageLimit: null,
      perCustomerLimit: 5,
      stackable: true,
      orderTypes: ["delivery"] as ("dine_in" | "takeout" | "delivery")[],
    },
    {
      code: "LUNCH10",
      title: "$10 off lunch for two",
      description: "Weekday lunches, orders over $45.",
      type: "fixed_off" as const,
      value: 10,
      minSpend: 45,
      usageLimit: 200,
      perCustomerLimit: 1,
      stackable: false,
      validTo: new Date(now.getTime() - 2 * DAY), // deliberately expired, for the demo
    },
  ];

  for (const v of voucherSeeds) {
    const [row] = await db
      .insert(s.voucher)
      .values({
        code: v.code,
        title: v.title,
        description: v.description,
        type: v.type,
        value: v.value,
        minSpend: v.minSpend,
        freeItemId: "freeItemId" in v ? v.freeItemId : null,
        orderTypes:
          "orderTypes" in v && v.orderTypes
            ? v.orderTypes
            : ["dine_in", "takeout", "delivery"],
        validFrom: ago30,
        validTo: "validTo" in v && v.validTo ? v.validTo : in90,
        usageLimit: v.usageLimit,
        perCustomerLimit: v.perCustomerLimit,
        stackable: v.stackable,
        targeted: false,
        active: true,
      })
      .returning();
    voucherIds.set(v.code, row.id);
  }

  /* ------------------------------ promotions ------------------------------ */
  await chunkInsert(s.promotion, [
    {
      type: "banner" as const,
      title: "Wood-fired Wednesdays",
      description: "Any pizza + a glass of Chianti for $24, every Wednesday.",
      config: {
        image:
          "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1400&q=70",
        ctaLabel: "See the pizzas",
        ctaHref: "/menu?category=Pizza",
      },
      active: true,
      sortOrder: 0,
    },
    {
      type: "first_order" as const,
      title: "First order welcome",
      description: "New guests get 15% off automatically at checkout.",
      config: { percentOff: 15 },
      active: true,
      sortOrder: 1,
    },
    {
      type: "happy_hour" as const,
      title: "Aperitivo hour",
      description: "20% off everything, weekdays 17:00–19:00.",
      config: {
        percentOff: 20,
        days: [1, 2, 3, 4, 5],
        startTime: "17:00",
        endTime: "19:00",
      },
      active: true,
      sortOrder: 2,
    },
    {
      type: "bundle" as const,
      title: "Lunch Combo",
      description: "Margherita + Bruschetta + Limonata for $24.",
      config: {
        itemIds: [
          itemIds.get("Margherita D.O.P.")!,
          itemIds.get("Bruschetta Classica")!,
          itemIds.get("Limonata Siciliana")!,
        ],
        bundlePrice: 24,
      },
      active: true,
      sortOrder: 3,
    },
    {
      type: "bogo" as const,
      title: "Two for one Tiramisù",
      description: "Buy a tiramisù, the second is free.",
      config: {
        buyItemId: itemIds.get("Tiramisù della Casa")!,
        getItemId: itemIds.get("Tiramisù della Casa")!,
      },
      active: false,
      sortOrder: 4,
    },
    {
      type: "birthday" as const,
      title: "Birthday treat",
      description: "$10 off in the week around your birthday.",
      config: { fixedOff: 10, daysBefore: 7 },
      active: true,
      sortOrder: 5,
    },
    {
      type: "referral" as const,
      title: "Give $10, get $10",
      description:
        "Your friend gets $10 off their first order, you get $10 when they use it.",
      config: { fixedOff: 10 },
      active: true,
      sortOrder: 6,
    },
  ]);

  /* ------------------------------- customers ------------------------------ */
  console.log("→ customers");
  const customerRows: { id: number; email: string; name: string }[] = [];
  for (const c of CUSTOMERS) {
    const [row] = await db
      .insert(s.customer)
      .values({
        name: c.name,
        email: c.email,
        phone: c.phone,
        birthday: c.birthday,
        allergies: c.allergies,
        preferences: c.preferences ?? null,
        marketingOptIn: chance(0.85),
        createdAt: new Date(now.getTime() - between(40, 400) * DAY),
      })
      .returning();
    customerRows.push({ id: row.id, email: row.email, name: row.name });
  }

  /* -------------------------------- orders -------------------------------- */
  console.log("→ orders");
  const weightedItems = ITEMS.map((i) => ({
    item: i,
    weight: i.weight ?? 5,
  }));

  const modifierCache = new Map<
    number,
    { group: s.ModifierGroup; options: s.ModifierOption[] }[]
  >();
  for (const id of itemIds.values()) {
    const groups = await db
      .select()
      .from(s.modifierGroup)
      .where(eq(s.modifierGroup.menuItemId, id));
    const withOptions = [];
    for (const g of groups) {
      const options = await db
        .select()
        .from(s.modifierOption)
        .where(eq(s.modifierOption.groupId, g.id));
      withOptions.push({ group: g, options });
    }
    modifierCache.set(id, withOptions);
  }

  const ORDERS_PER_FREQUENCY: Record<string, [number, number]> = {
    heavy: [11, 15],
    regular: [4, 7],
    occasional: [2, 3],
    once: [1, 1],
    lapsed: [3, 6],
  };

  const courseFor = (categoryName: string) =>
    categoryName === "Starters"
      ? ("starter" as const)
      : categoryName === "Desserts"
        ? ("dessert" as const)
        : categoryName === "Drinks"
          ? ("drink" as const)
          : ("main" as const);

  let orderSeq = 2400;
  const createdOrders: {
    id: number;
    customerId: number;
    total: number;
    placedAt: Date;
    status: string;
    voucherId: number | null;
    discount: number;
  }[] = [];

  type PlannedOrder = {
    customerIdx: number;
    placedAt: Date;
    status: s.OrderStatus;
  };
  const planned: PlannedOrder[] = [];

  CUSTOMERS.forEach((c, idx) => {
    const [min, max] = ORDERS_PER_FREQUENCY[c.frequency];
    const count = between(min, max);
    for (let i = 0; i < count; i++) {
      let daysAgo: number;
      if (c.frequency === "lapsed") daysAgo = between(95, 260);
      else if (c.frequency === "once") daysAgo = between(1, 28);
      else daysAgo = between(0, 29);

      const placedAt = new Date(
        now.getTime() -
          daysAgo * DAY -
          between(0, 10) * 3_600_000 -
          between(0, 59) * 60_000,
      );
      // Skew the clock towards service hours so the hour-of-day chart looks real.
      placedAt.setHours(
        chance(0.42) ? between(12, 14) : between(17, 21),
        between(0, 59),
        0,
        0,
      );

      planned.push({
        customerIdx: idx,
        placedAt,
        status: daysAgo < 1 ? "preparing" : "completed",
      });
    }
  });

  planned.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());

  for (const p of planned) {
    const cust = customerRows[p.customerIdx];
    const seedCustomer = CUSTOMERS[p.customerIdx];

    const type = weightedPick([
      { item: "dine_in" as const, weight: 34 },
      { item: "takeout" as const, weight: 33 },
      { item: "delivery" as const, weight: 33 },
    ]);

    // --- lines ---
    const lineCount = between(1, 4);
    const chosen = new Set<string>();
    const lines: {
      menuItemId: number;
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      resolvedModifiers: s.ResolvedModifier[];
      course: "starter" | "main" | "dessert" | "drink";
      note: string | null;
    }[] = [];

    for (let i = 0; i < lineCount; i++) {
      const item = weightedPick(weightedItems);
      if (chosen.has(item.name)) continue;
      chosen.add(item.name);
      const id = itemIds.get(item.name)!;

      const resolvedModifiers: s.ResolvedModifier[] = [];
      let delta = 0;
      for (const { group, options } of modifierCache.get(id) ?? []) {
        if (group.required || chance(0.35)) {
          const howMany =
            group.selectionType === "single" ? 1 : between(1, Math.min(2, group.maxSelection));
          const picked = new Set<number>();
          for (let k = 0; k < howMany; k++) {
            const opt = pick(options);
            if (picked.has(opt.id)) continue;
            picked.add(opt.id);
            delta += opt.priceDelta;
            resolvedModifiers.push({
              groupId: group.id,
              groupName: group.name,
              optionId: opt.id,
              optionName: opt.name,
              priceDelta: opt.priceDelta,
            });
          }
        }
      }

      const quantity = chance(0.22) ? 2 : 1;
      const unitPrice = round2(item.price + delta);
      lines.push({
        menuItemId: id,
        name: item.name,
        quantity,
        unitPrice,
        lineTotal: round2(unitPrice * quantity),
        resolvedModifiers,
        course: courseFor(item.category),
        note: chance(0.12)
          ? pick([
              "No chilli please",
              "Extra crispy",
              "Allergy: see profile",
              "Cut into 8 slices",
              "Sauce on the side",
            ])
          : null,
      });
    }
    if (lines.length === 0) continue;

    const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));

    // --- discounts ---
    let discountAmount = 0;
    let voucherId: number | null = null;
    let voucherCode: string | null = null;
    const appliedDiscounts: {
      kind: "voucher" | "tier" | "promotion";
      code?: string;
      label: string;
      amount: number;
      voucherId?: number;
    }[] = [];

    if (chance(0.26)) {
      if (type === "delivery" && subtotal >= 25 && chance(0.4)) {
        voucherCode = "FREEDELIV";
      } else if (subtotal >= 30) {
        voucherCode = chance(0.75) ? "BELLA15" : "GARLICFREE";
      } else if (subtotal >= 20) {
        voucherCode = "GARLICFREE";
      }
      if (voucherCode === "GARLICFREE" && !chosen.has("Garlic Bread al Forno")) {
        voucherCode = subtotal >= 30 ? "BELLA15" : null;
      }
    }

    // --- delivery fee ---
    let deliveryFee = 0;
    let deliveryZoneId: number | null = null;
    if (type === "delivery") {
      const zi = weightedPick([
        { item: 0, weight: 45 },
        { item: 1, weight: 35 },
        { item: 2, weight: 20 },
      ]);
      deliveryZoneId = zoneIds[zi];
      deliveryFee = ZONES[zi].fee;
    }

    if (voucherCode) {
      voucherId = voucherIds.get(voucherCode)!;
      if (voucherCode === "BELLA15") discountAmount = round2(subtotal * 0.15);
      else if (voucherCode === "FREEDELIV") {
        discountAmount = deliveryFee;
        deliveryFee = 0;
      } else if (voucherCode === "GARLICFREE") discountAmount = 4;
      appliedDiscounts.push({
        kind: "voucher",
        code: voucherCode,
        voucherId,
        label: voucherSeeds.find((v) => v.code === voucherCode)!.title,
        amount: discountAmount,
      });
    }

    const discountedFood = round2(subtotal - discountAmount);
    const serviceCharge = round2(discountedFood * 0.05);
    const taxable = round2(discountedFood + serviceCharge + deliveryFee);
    const taxAmount = round2(taxable * 0.08);
    const tip =
      type === "dine_in" && chance(0.55)
        ? round2(discountedFood * pick([0.1, 0.15, 0.2]))
        : 0;
    const total = round2(taxable + taxAmount + tip);

    const paymentMethod = weightedPick([
      { item: "card" as const, weight: 52 },
      { item: "apple_pay" as const, weight: 16 },
      { item: "google_pay" as const, weight: 10 },
      { item: "cash" as const, weight: 12 },
      { item: "simulated" as const, weight: 10 },
    ]);

    const isRefunded = chance(0.03);
    const isCanceled = !isRefunded && chance(0.04);
    const status: s.OrderStatus = isRefunded
      ? "refunded"
      : isCanceled
        ? "canceled"
        : p.status;

    const prepTotal = 12;
    const acceptedAt = new Date(p.placedAt.getTime() + between(1, 4) * 60_000);
    const readyAt = new Date(acceptedAt.getTime() + between(11, 26) * 60_000);
    const completedAt = new Date(readyAt.getTime() + between(3, 40) * 60_000);

    const [row] = await db
      .insert(s.order)
      .values({
        number: `BC-${++orderSeq}`,
        customerId: cust.id,
        guestName: cust.name,
        guestEmail: cust.email,
        guestPhone: seedCustomer.phone,
        type,
        tableNumber: type === "dine_in" ? between(1, 14) : null,
        address:
          type === "delivery"
            ? `${between(2, 240)} ${pick(["Vine", "Elm", "Harbour", "Chestnut", "Maple"])} Street, Apt ${between(1, 40)}`
            : null,
        deliveryZoneId,
        pickupSlot:
          type === "takeout"
            ? `${String(p.placedAt.getHours()).padStart(2, "0")}:${between(0, 1) ? "30" : "00"}`
            : null,
        status,
        cancelReason: isCanceled
          ? pick([
              "Customer changed their mind",
              "Item unavailable",
              "Duplicate order",
            ])
          : null,
        subtotal,
        serviceCharge,
        taxAmount,
        deliveryFee,
        discountAmount,
        tip,
        total,
        appliedDiscounts,
        voucherId,
        voucherCode,
        paymentMethod,
        paymentStatus: isRefunded
          ? "refunded"
          : isCanceled
            ? "failed"
            : "captured",
        paymentIntentId: `pi_demo_${Math.floor(rnd() * 1e10).toString(36)}`,
        pointsEarned: 0,
        placedAt: p.placedAt,
        acceptedAt,
        readyAt,
        completedAt: status === "completed" ? completedAt : null,
        eta: new Date(p.placedAt.getTime() + prepTotal * 60_000),
        source: chance(0.24) ? "pos" : "storefront",
      })
      .returning();

    await chunkInsert(
      s.orderItem,
      lines.map((l) => ({ ...l, orderId: row.id })),
    );

    if (voucherId) {
      await db
        .update(s.voucher)
        .set({ usesCount: (await currentUses(voucherId)) + 1 })
        .where(eq(s.voucher.id, voucherId));
      await db.insert(s.voucherRedemption).values({
        voucherId,
        customerId: cust.id,
        email: cust.email,
        orderId: row.id,
        discountAmount,
        orderRevenue: total,
        createdAt: p.placedAt,
      });
    }

    createdOrders.push({
      id: row.id,
      customerId: cust.id,
      total,
      placedAt: p.placedAt,
      status,
      voucherId,
      discount: discountAmount,
    });
  }

  async function currentUses(id: number) {
    const [v] = await db
      .select({ uses: s.voucher.usesCount })
      .from(s.voucher)
      .where(eq(s.voucher.id, id));
    return v?.uses ?? 0;
  }

  /* --------------------------- live kitchen orders ------------------------ */
  console.log("→ live kitchen tickets");
  const liveStatuses: s.OrderStatus[] = [
    "new",
    "new",
    "accepted",
    "preparing",
    "preparing",
    "ready",
  ];
  for (const [i, status] of liveStatuses.entries()) {
    const cust = customerRows[between(0, customerRows.length - 1)];
    const minutesAgo = [2, 5, 9, 16, 23, 31][i];
    const placedAt = new Date(now.getTime() - minutesAgo * 60_000);
    const type = pick(["dine_in", "takeout", "delivery"] as const);

    const lines = Array.from({ length: between(1, 3) }).map(() => {
      const item = weightedPick(weightedItems);
      const id = itemIds.get(item.name)!;
      const quantity = chance(0.3) ? 2 : 1;
      return {
        menuItemId: id,
        name: item.name,
        quantity,
        unitPrice: item.price,
        lineTotal: round2(item.price * quantity),
        resolvedModifiers: [] as s.ResolvedModifier[],
        course: courseFor(item.category),
        note: i % 3 === 0 ? "Nut allergy — separate board please" : null,
      };
    });

    const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    const serviceCharge = round2(subtotal * 0.05);
    const deliveryFee = type === "delivery" ? 3 : 0;
    const taxAmount = round2((subtotal + serviceCharge + deliveryFee) * 0.08);

    const [row] = await db
      .insert(s.order)
      .values({
        number: `BC-${++orderSeq}`,
        customerId: cust.id,
        guestName: cust.name,
        guestEmail: cust.email,
        type,
        tableNumber: type === "dine_in" ? between(1, 14) : null,
        deliveryZoneId: type === "delivery" ? zoneIds[1] : null,
        address:
          type === "delivery" ? `${between(2, 90)} Harbour Street, Apt 12` : null,
        status,
        subtotal,
        serviceCharge,
        taxAmount,
        deliveryFee,
        total: round2(subtotal + serviceCharge + deliveryFee + taxAmount),
        paymentMethod: "card",
        paymentStatus: "captured",
        placedAt,
        acceptedAt: status === "new" ? null : new Date(placedAt.getTime() + 90_000),
        readyAt: status === "ready" ? new Date(now.getTime() - 60_000) : null,
        eta: new Date(placedAt.getTime() + 20 * 60_000),
        source: "storefront",
      })
      .returning();

    await chunkInsert(
      s.orderItem,
      lines.map((l) => ({ ...l, orderId: row.id })),
    );
  }

  /* ------------------------------ points ledger --------------------------- */
  console.log("→ loyalty ledger");
  const ledgerRows = createdOrders
    .filter((o) => o.status === "completed")
    .map((o) => {
      const foodValue = round2(o.total * 0.82);
      const points = Math.max(10, Math.floor(foodValue * 10));
      return {
        customerId: o.customerId,
        orderId: o.id,
        points,
        state: "active" as const,
        reason: "order",
        expiresAt: new Date(o.placedAt.getTime() + 18 * 30 * DAY),
        createdAt: o.placedAt,
      };
    });
  await chunkInsert(s.pointsLedger, ledgerRows);

  for (const o of createdOrders) {
    const match = ledgerRows.find((l) => l.orderId === o.id);
    if (match) {
      await db
        .update(s.order)
        .set({ pointsEarned: match.points })
        .where(eq(s.order.id, o.id));
    }
  }

  /* -------------------------------- reviews ------------------------------- */
  console.log("→ reviews");
  const reviewable = createdOrders.filter((o) => o.status === "completed");
  const reviewRows = REVIEW_COMMENTS.map((r, i) => {
    const o = reviewable[Math.floor((i / REVIEW_COMMENTS.length) * reviewable.length)];
    if (!o) return null;
    return {
      orderId: o.id,
      customerId: o.customerId,
      rating: r.rating,
      comment: r.comment,
      reply:
        r.rating <= 3
          ? "Thank you for the honest feedback — we've spoken to the team and would love to make it right on your next visit."
          : null,
      repliedAt: r.rating <= 3 ? new Date(o.placedAt.getTime() + 2 * DAY) : null,
      createdAt: new Date(o.placedAt.getTime() + DAY),
    };
  }).filter(Boolean) as Record<string, unknown>[];
  await chunkInsert(s.review, reviewRows);

  /* ------------------------------- campaigns ------------------------------ */
  console.log("→ campaigns");
  const campaignSeeds = [
    {
      name: "We miss you — 20% back",
      recipe: "we_miss_you",
      targetSegment: "dormant",
      subject: "It's been a while — here's 20% off",
      body: "We noticed it's been over 75 days since your last visit. Come back and take 20% off anything on the menu.",
      daysAgo: 12,
      recipients: 6,
      openRate: 0.55,
      clickRate: 0.28,
      redeemRate: 0.2,
    },
    {
      name: "Second order nudge",
      recipe: "second_order",
      targetSegment: "new",
      subject: "Ready for round two?",
      body: "Your first order was on us to impress. Here's 15% off your second — valid for 14 days.",
      daysAgo: 20,
      recipients: 5,
      openRate: 0.62,
      clickRate: 0.35,
      redeemRate: 0.3,
    },
    {
      name: "VIP first look: autumn menu",
      recipe: "vip_preview",
      targetSegment: "vip",
      subject: "You're first to see the autumn menu",
      body: "Truffle season is here. VIP members get first bookings before we announce publicly.",
      daysAgo: 5,
      recipients: 4,
      openRate: 0.78,
      clickRate: 0.5,
      redeemRate: 0.25,
    },
  ];

  for (const c of campaignSeeds) {
    const sentAt = new Date(now.getTime() - c.daysAgo * DAY);
    const redeemed = Math.round(c.recipients * c.redeemRate);
    const revenue = round2(redeemed * between(38, 72));
    const [row] = await db
      .insert(s.campaign)
      .values({
        name: c.name,
        recipe: c.recipe,
        channel: "simulated",
        targetSegment: c.targetSegment,
        subject: c.subject,
        body: c.body,
        status: "sent",
        recipients: c.recipients,
        opens: Math.round(c.recipients * c.openRate),
        clicks: Math.round(c.recipients * c.clickRate),
        redeemed,
        revenue,
        discountCost: round2(revenue * 0.16),
        sentAt,
        createdAt: sentAt,
      })
      .returning();

    const targets = customerRows.slice(0, c.recipients);
    await chunkInsert(
      s.campaignRecipient,
      targets.map((t, i) => ({
        campaignId: row.id,
        customerId: t.id,
        opened: i < Math.round(c.recipients * c.openRate),
        clicked: i < Math.round(c.recipients * c.clickRate),
        revenue: i < redeemed ? round2(revenue / Math.max(1, redeemed)) : 0,
        createdAt: sentAt,
      })),
    );

    await chunkInsert(
      s.notification,
      targets.map((t) => ({
        customerId: t.id,
        campaignId: row.id,
        title: c.subject,
        message: c.body,
        channel: "email" as const,
        kind: "campaign" as const,
        href: "/menu",
        sentAt,
      })),
    );
  }

  /* ---------------------------- order notifications ----------------------- */
  const recentOrders = createdOrders.slice(-14);
  await chunkInsert(
    s.notification,
    recentOrders.map((o) => ({
      customerId: o.customerId,
      orderId: o.id,
      title: "Your order is on the way",
      message: `Thanks for ordering with Bella Cucina. We'll let you know the moment it's ready.`,
      channel: "push" as const,
      kind: "order" as const,
      href: `/order/${o.id}`,
      sentAt: o.placedAt,
      readAt: chance(0.6) ? new Date(o.placedAt.getTime() + 3600_000) : null,
    })),
  );

  /* ------------------------------- favourites ----------------------------- */
  const favouriteRows: { customerId: number; menuItemId: number }[] = [];
  for (const c of customerRows.slice(0, 12)) {
    const picks = new Set<number>();
    for (let i = 0; i < between(1, 3); i++) {
      picks.add(itemIds.get(weightedPick(weightedItems).name)!);
    }
    for (const id of picks)
      favouriteRows.push({ customerId: c.id, menuItemId: id });
  }
  await chunkInsert(s.favorite, favouriteRows);

  /* ------------------------------ activity log ---------------------------- */
  await chunkInsert(
    s.staffActivityLog,
    Array.from({ length: 16 }).map((_, i) => ({
      userId: staffIds[between(0, staffIds.length - 1)],
      userName: pick(STAFF).name,
      action: pick([
        "Bumped ticket",
        "Applied refund",
        "Updated menu item",
        "Created voucher",
        "Changed table status",
        "Sent campaign",
        "Voided item",
      ]),
      detail: pick([
        "Order BC-2431",
        "Margherita D.O.P. price updated to $14.50",
        "Table 6 → occupied",
        "Voucher BELLA15 usage limit raised",
        "Campaign “We miss you” sent to 6 dormant guests",
      ]),
      createdAt: new Date(now.getTime() - i * between(2, 20) * 3_600_000),
    })),
  );

  /* -------------------------- derived CRM + loyalty ----------------------- */
  console.log("→ recomputing segments & tiers");
  const { recomputeAllCustomers } = await import("@/lib/segments");
  const { recomputeLoyalty } = await import("@/lib/loyalty");
  await recomputeAllCustomers();
  for (const c of customerRows) await recomputeLoyalty(c.id);

  /* ------------------- a targeted offer so "My offers" is alive ------------ */
  const { issueManualVoucher } = await import("@/lib/loyalty");
  await issueManualVoucher({
    customerId: customerRows[0].id,
    type: "fixed_off",
    value: 5,
    minSpend: 20,
    expiryDays: 30,
    title: "$5 off — thanks for being a regular",
    source: "manual",
  });

  const counts = {
    categories: CATEGORIES.length,
    items: ITEMS.length,
    customers: customerRows.length,
    orders: createdOrders.length + liveStatuses.length,
    reviews: reviewRows.length,
    staff: STAFF.length,
  };

  console.log(
    `\n✓ Seeded in ${((Date.now() - started) / 1000).toFixed(1)}s`,
    JSON.stringify(counts, null, 2),
  );
  return counts;
}

// Allow `tsx src/db/seed.ts` and programmatic use from /api/seed-protected.
const invokedDirectly =
  process.argv[1]?.replace(/\\/g, "/").endsWith("src/db/seed.ts") ?? false;

if (invokedDirectly) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
