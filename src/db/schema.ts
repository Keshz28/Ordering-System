import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

const pk = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

/* -------------------------------------------------------------------------- */
/*  Branches                                                                  */
/* -------------------------------------------------------------------------- */

export type OpeningHours = Record<
  string,
  { open: string; close: string; closed?: boolean }
>;

/**
 * An outlet. Orders, tables, reservations and most staff belong to exactly one;
 * the menu catalogue is shared chain-wide, with per-branch availability handled
 * by `branch_menu_item`.
 */
export const branch = sqliteTable("branch", {
  id: pk(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Short label for chips and pickers, e.g. "Bangsar". */
  shortName: text("short_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull().default("Selangor"),
  postcode: text("postcode").notNull().default(""),
  phone: text("phone").notNull().default(""),
  lat: real("lat"),
  lng: real("lng"),
  image: text("image"),
  /** One line of colour for the branch picker. */
  blurb: text("blurb"),
  openingHours: text("opening_hours", { mode: "json" })
    .$type<OpeningHours>()
    .default({}),
  /** Delivery is refused beyond this radius. */
  deliveryRadiusKm: real("delivery_radius_km").notNull().default(8),
  acceptsDelivery: integer("accepts_delivery", { mode: "boolean" })
    .notNull()
    .default(true),
  acceptsReservations: integer("accepts_reservations", { mode: "boolean" })
    .notNull()
    .default(true),
  /** How the dining room is described on the reservation floor map. */
  floorPlanNote: text("floor_plan_note"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------------- */
/*  Staff & customers                                                         */
/* -------------------------------------------------------------------------- */

/** Staff accounts. Roles are enforced server-side in src/lib/auth.ts. */
export const user = sqliteTable("user", {
  id: pk(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", {
    enum: ["owner", "manager", "cashier", "kitchen"],
  })
    .notNull()
    .default("cashier"),
  /** null = group-wide access (owners and area managers). */
  branchId: integer("branch_id").references(() => branch.id),
  passwordHash: text("password_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const customer = sqliteTable(
  "customer",
  {
    id: pk(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    /** ISO date string YYYY-MM-DD; year is kept but only month/day are used. */
    birthday: text("birthday"),
    allergies: text("allergies", { mode: "json" }).$type<string[]>().default([]),
    preferences: text("preferences"),
    /** Current spendable balance. The authoritative history lives in points_ledger. */
    loyaltyPoints: integer("loyalty_points").notNull().default(0),
    /** Points earned in the rolling 12-month window; drives tier. */
    tierPoints: integer("tier_points").notNull().default(0),
    tierId: integer("tier_id"),
    totalSpent: real("total_spent").notNull().default(0),
    orderCount: integer("order_count").notNull().default(0),
    /** Denormalised auto-segment; recomputed by src/lib/segments.ts. */
    segment: text("segment", {
      enum: ["new", "repeat", "vip", "at_risk", "dormant"],
    })
      .notNull()
      .default("new"),
    highAov: integer("high_aov", { mode: "boolean" }).notNull().default(false),
    promoHunter: integer("promo_hunter", { mode: "boolean" })
      .notNull()
      .default(false),
    lastOrderAt: integer("last_order_at", { mode: "timestamp" }),
    marketingOptIn: integer("marketing_opt_in", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("customer_email_idx").on(t.email)],
);

/** 6-digit passwordless login codes for the storefront. */
export const loginToken = sqliteTable(
  "login_token",
  {
    id: pk(),
    email: text("email").notNull(),
    code: text("code").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp" }),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("login_token_email_idx").on(t.email)],
);

/* -------------------------------------------------------------------------- */
/*  Menu                                                                      */
/* -------------------------------------------------------------------------- */

export const category = sqliteTable("category", {
  id: pk(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  image: text("image"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const menuItem = sqliteTable(
  "menu_item",
  {
    id: pk(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => category.id),
    name: text("name").notNull(),
    description: text("description"),
    price: real("price").notNull(),
    image: text("image"),
    allergens: text("allergens", { mode: "json" }).$type<string[]>().default([]),
    prepMinutes: integer("prep_minutes").notNull().default(12),
    isAvailable: integer("is_available", { mode: "boolean" })
      .notNull()
      .default(true),
    /** "HH:MM" 24h window; null = all day. */
    availableFrom: text("available_from"),
    availableTo: text("available_to"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    /** null = untracked stock, 0 = auto sold out. */
    stock: integer("stock"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("menu_item_category_idx").on(t.categoryId)],
);

export const modifierGroup = sqliteTable("modifier_group", {
  id: pk(),
  menuItemId: integer("menu_item_id")
    .notNull()
    .references(() => menuItem.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  selectionType: text("selection_type", { enum: ["single", "multi"] })
    .notNull()
    .default("single"),
  required: integer("required", { mode: "boolean" }).notNull().default(false),
  minSelection: integer("min_selection").notNull().default(0),
  maxSelection: integer("max_selection").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * Per-branch availability. The catalogue and its prices are chain-wide, but a
 * branch can run out of squid ink or take a dish off for the evening without
 * affecting the others.
 */
export const branchMenuItem = sqliteTable(
  "branch_menu_item",
  {
    id: pk(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branch.id, { onDelete: "cascade" }),
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItem.id, { onDelete: "cascade" }),
    isAvailable: integer("is_available", { mode: "boolean" })
      .notNull()
      .default(true),
    /** null = untracked at this branch, 0 = sold out here. */
    stock: integer("stock"),
  },
  (t) => [
    uniqueIndex("branch_menu_item_unique_idx").on(t.branchId, t.menuItemId),
  ],
);

export const modifierOption = sqliteTable("modifier_option", {
  id: pk(),
  groupId: integer("group_id")
    .notNull()
    .references(() => modifierGroup.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceDelta: real("price_delta").notNull().default(0),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* -------------------------------------------------------------------------- */
/*  Orders                                                                    */
/* -------------------------------------------------------------------------- */

export type ResolvedModifier = {
  groupId: number;
  groupName: string;
  optionId: number;
  optionName: string;
  priceDelta: number;
};

export const order = sqliteTable(
  "order",
  {
    id: pk(),
    /** Human-facing reference, e.g. BC-2847. */
    number: text("number").notNull().unique(),
    /** The outlet that cooks and fulfils this order. */
    branchId: integer("branch_id").references(() => branch.id),
    customerId: integer("customer_id").references(() => customer.id),
    guestName: text("guest_name"),
    guestEmail: text("guest_email"),
    guestPhone: text("guest_phone"),
    type: text("type", { enum: ["dine_in", "takeout", "delivery"] })
      .notNull()
      .default("takeout"),
    tableNumber: integer("table_number"),
    address: text("address"),
    deliveryZoneId: integer("delivery_zone_id").references(
      () => deliveryZone.id,
    ),
    pickupSlot: text("pickup_slot"),
    status: text("status", {
      enum: [
        "new",
        "accepted",
        "preparing",
        "ready",
        "dispatched",
        "completed",
        "canceled",
        "refunded",
      ],
    })
      .notNull()
      .default("new"),
    cancelReason: text("cancel_reason"),
    subtotal: real("subtotal").notNull().default(0),
    serviceCharge: real("service_charge").notNull().default(0),
    taxAmount: real("tax_amount").notNull().default(0),
    deliveryFee: real("delivery_fee").notNull().default(0),
    discountAmount: real("discount_amount").notNull().default(0),
    tip: real("tip").notNull().default(0),
    total: real("total").notNull().default(0),
    /** Snapshot of every discount applied, for promotion ROI reporting. */
    appliedDiscounts: text("applied_discounts", { mode: "json" })
      .$type<
        {
          kind: "voucher" | "tier" | "promotion";
          code?: string;
          label: string;
          amount: number;
          voucherId?: number;
          promotionId?: number;
        }[]
      >()
      .default([]),
    voucherId: integer("voucher_id").references(() => voucher.id),
    voucherCode: text("voucher_code"),
    campaignId: integer("campaign_id"),
    paymentMethod: text("payment_method", {
      enum: [
        "card",
        "fpx",
        "duitnow_qr",
        "tng",
        "grabpay",
        "boost",
        "shopeepay",
        "apple_pay",
        "google_pay",
        "cash",
        "simulated",
      ],
    })
      .notNull()
      .default("simulated"),
    /** FPX bank or e-wallet chosen, for the receipt line. */
    paymentDetail: text("payment_detail"),
    paymentStatus: text("payment_status", {
      enum: ["pending", "authorized", "captured", "failed", "refunded"],
    })
      .notNull()
      .default("pending"),
    paymentIntentId: text("payment_intent_id"),
    checkoutSessionId: text("checkout_session_id"),
    pointsEarned: integer("points_earned").notNull().default(0),
    placedAt: integer("placed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    readyAt: integer("ready_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    eta: integer("eta", { mode: "timestamp" }),
    note: text("note"),
    source: text("source", { enum: ["storefront", "pos"] })
      .notNull()
      .default("storefront"),
  },
  (t) => [
    index("order_customer_idx").on(t.customerId),
    index("order_placed_idx").on(t.placedAt),
    index("order_status_idx").on(t.status),
  ],
);

export const orderItem = sqliteTable(
  "order_item",
  {
    id: pk(),
    orderId: integer("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    menuItemId: integer("menu_item_id").references(() => menuItem.id),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: real("unit_price").notNull(),
    lineTotal: real("line_total").notNull(),
    note: text("note"),
    resolvedModifiers: text("resolved_modifiers", { mode: "json" })
      .$type<ResolvedModifier[]>()
      .default([]),
    voided: integer("voided", { mode: "boolean" }).notNull().default(false),
    course: text("course", { enum: ["starter", "main", "dessert", "drink"] })
      .notNull()
      .default("main"),
  },
  (t) => [index("order_item_order_idx").on(t.orderId)],
);

export const deliveryZone = sqliteTable("delivery_zone", {
  id: pk(),
  name: text("name").notNull(),
  radiusKm: real("radius_km").notNull().default(3),
  fee: real("fee").notNull().default(0),
  minOrder: real("min_order").notNull().default(0),
  etaMinutes: integer("eta_minutes").notNull().default(35),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/**
 * A courier booking for one delivery order.
 *
 * The columns mirror what on-demand courier APIs actually return (a provider
 * reference, a quoted fee, a named driver with a plate, a coarse status and a
 * progress fraction), so the built-in simulated provider and a real Lalamove,
 * Grab Express or Delyva account can populate the same row. See
 * src/lib/delivery.ts for the provider interface.
 */
export const deliveryJob = sqliteTable(
  "delivery_job",
  {
    id: pk(),
    orderId: integer("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    branchId: integer("branch_id").references(() => branch.id),
    provider: text("provider", {
      enum: ["simulated", "lalamove", "grab_express", "delyva", "pandago", "borzo"],
    })
      .notNull()
      .default("simulated"),
    /** The provider's own booking id. */
    providerRef: text("provider_ref"),
    status: text("status", {
      enum: [
        "quoted",
        "requested",
        "assigned",
        "picking_up",
        "on_the_way",
        "delivered",
        "cancelled",
        "failed",
      ],
    })
      .notNull()
      .default("quoted"),
    fee: real("fee").notNull().default(0),
    distanceKm: real("distance_km").notNull().default(0),
    etaMinutes: integer("eta_minutes").notNull().default(30),
    driverName: text("driver_name"),
    driverPhone: text("driver_phone"),
    vehicleType: text("vehicle_type", {
      enum: ["motorcycle", "car", "van"],
    })
      .notNull()
      .default("motorcycle"),
    plateNumber: text("plate_number"),
    driverRating: real("driver_rating"),
    /** 0–1 along the branch→customer route; drives the tracking map. */
    progress: real("progress").notNull().default(0),
    pickupAddress: text("pickup_address"),
    dropoffAddress: text("dropoff_address"),
    assignedAt: integer("assigned_at", { mode: "timestamp" }),
    pickedUpAt: integer("picked_up_at", { mode: "timestamp" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
    proofNote: text("proof_note"),
    createdAt: createdAt(),
  },
  (t) => [index("delivery_job_order_idx").on(t.orderId)],
);

/* -------------------------------------------------------------------------- */
/*  Promotions, vouchers, loyalty                                             */
/* -------------------------------------------------------------------------- */

export const voucher = sqliteTable("voucher", {
  id: pk(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", {
    enum: ["percent_off", "fixed_off", "free_item", "free_delivery"],
  })
    .notNull()
    .default("percent_off"),
  value: real("value").notNull().default(0),
  minSpend: real("min_spend").notNull().default(0),
  /** Restricts a percent/fixed discount, or names the gifted item for free_item. */
  applicableItems: text("applicable_items", { mode: "json" }).$type<
    number[] | null
  >(),
  applicableCategories: text("applicable_categories", {
    mode: "json",
  }).$type<number[] | null>(),
  freeItemId: integer("free_item_id").references(() => menuItem.id),
  orderTypes: text("order_types", { mode: "json" })
    .$type<("dine_in" | "takeout" | "delivery")[]>()
    .default(["dine_in", "takeout", "delivery"]),
  validFrom: integer("valid_from", { mode: "timestamp" }),
  validTo: integer("valid_to", { mode: "timestamp" }),
  usageLimit: integer("usage_limit"),
  perCustomerLimit: integer("per_customer_limit").default(1),
  usesCount: integer("uses_count").notNull().default(0),
  stackable: integer("stackable", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** true = only usable by customers it was explicitly issued to. */
  targeted: integer("targeted", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

/** A voucher handed to one specific customer (manual gift, loyalty redemption, campaign). */
export const customerVoucher = sqliteTable(
  "customer_voucher",
  {
    id: pk(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    voucherId: integer("voucher_id")
      .notNull()
      .references(() => voucher.id, { onDelete: "cascade" }),
    source: text("source", {
      enum: ["manual", "loyalty", "campaign", "referral", "birthday", "review"],
    })
      .notNull()
      .default("manual"),
    campaignId: integer("campaign_id"),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    redeemedAt: integer("redeemed_at", { mode: "timestamp" }),
    redeemedOrderId: integer("redeemed_order_id"),
    createdAt: createdAt(),
  },
  (t) => [index("customer_voucher_customer_idx").on(t.customerId)],
);

/** One row per (customer, voucher) use — enforces per-customer limits. */
export const voucherRedemption = sqliteTable(
  "voucher_redemption",
  {
    id: pk(),
    voucherId: integer("voucher_id")
      .notNull()
      .references(() => voucher.id, { onDelete: "cascade" }),
    customerId: integer("customer_id").references(() => customer.id),
    email: text("email"),
    orderId: integer("order_id").references(() => order.id, {
      onDelete: "cascade",
    }),
    discountAmount: real("discount_amount").notNull().default(0),
    orderRevenue: real("order_revenue").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("voucher_redemption_voucher_idx").on(t.voucherId)],
);

export type PromotionConfig = {
  /** banner */
  image?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** first_order / happy_hour / birthday */
  percentOff?: number;
  fixedOff?: number;
  /** happy_hour */
  days?: number[];
  startTime?: string;
  endTime?: string;
  /** bogo */
  buyItemId?: number;
  getItemId?: number;
  /** bundle */
  itemIds?: number[];
  bundlePrice?: number;
  /** birthday */
  daysBefore?: number;
  voucherCode?: string;
};

export const promotion = sqliteTable("promotion", {
  id: pk(),
  type: text("type", {
    enum: [
      "banner",
      "first_order",
      "happy_hour",
      "bogo",
      "bundle",
      "birthday",
      "referral",
    ],
  })
    .notNull()
    .default("banner"),
  title: text("title").notNull(),
  description: text("description"),
  config: text("config", { mode: "json" }).$type<PromotionConfig>().default({}),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const loyaltyTier = sqliteTable("loyalty_tier", {
  id: pk(),
  name: text("name").notNull(),
  minPoints: integer("min_points").notNull().default(0),
  /** Points earned per RM1 of qualifying spend. */
  earnRate: integer("earn_rate").notNull().default(10),
  /** Automatic checkout discount, e.g. 0.05 = 5%. */
  discountRate: real("discount_rate").notNull().default(0),
  freeDelivery: integer("free_delivery", { mode: "boolean" })
    .notNull()
    .default(false),
  benefits: text("benefits", { mode: "json" }).$type<string[]>().default([]),
  color: text("color").notNull().default("#8B1E1E"),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** The redemption catalogue: points -> voucher. */
export const loyaltyRedemption = sqliteTable("loyalty_redemption", {
  id: pk(),
  name: text("name").notNull(),
  description: text("description"),
  pointsCost: integer("points_cost").notNull(),
  rewardType: text("reward_type", {
    enum: ["percent_off", "fixed_off", "free_item"],
  })
    .notNull()
    .default("fixed_off"),
  rewardValue: real("reward_value").notNull().default(0),
  freeItemId: integer("free_item_id").references(() => menuItem.id),
  minSpend: real("min_spend").notNull().default(0),
  validDays: integer("valid_days").notNull().default(60),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/** Append-only points history. Balances are derived from `active` rows. */
export const pointsLedger = sqliteTable(
  "points_ledger",
  {
    id: pk(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    orderId: integer("order_id").references(() => order.id, {
      onDelete: "set null",
    }),
    points: integer("points").notNull(),
    state: text("state", {
      enum: ["pending", "active", "redeemed", "expired", "clawed_back"],
    })
      .notNull()
      .default("pending"),
    reason: text("reason").notNull().default("order"),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    warned90At: integer("warned_90_at", { mode: "timestamp" }),
    warned30At: integer("warned_30_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("points_ledger_customer_idx").on(t.customerId)],
);

/* -------------------------------------------------------------------------- */
/*  CRM                                                                       */
/* -------------------------------------------------------------------------- */

export const review = sqliteTable("review", {
  id: pk(),
  orderId: integer("order_id").references(() => order.id, {
    onDelete: "cascade",
  }),
  customerId: integer("customer_id").references(() => customer.id),
  rating: integer("rating").notNull().default(5),
  comment: text("comment"),
  reply: text("reply"),
  repliedAt: integer("replied_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export const campaign = sqliteTable("campaign", {
  id: pk(),
  name: text("name").notNull(),
  recipe: text("recipe"),
  channel: text("channel", { enum: ["email", "sms", "simulated"] })
    .notNull()
    .default("simulated"),
  targetSegment: text("target_segment").notNull().default("all"),
  subject: text("subject"),
  body: text("body").notNull().default(""),
  voucherId: integer("voucher_id").references(() => voucher.id),
  status: text("status", { enum: ["draft", "sent"] })
    .notNull()
    .default("draft"),
  recipients: integer("recipients").notNull().default(0),
  opens: integer("opens").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  redeemed: integer("redeemed").notNull().default(0),
  revenue: real("revenue").notNull().default(0),
  discountCost: real("discount_cost").notNull().default(0),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export const campaignRecipient = sqliteTable(
  "campaign_recipient",
  {
    id: pk(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    opened: integer("opened", { mode: "boolean" }).notNull().default(false),
    clicked: integer("clicked", { mode: "boolean" }).notNull().default(false),
    redeemedOrderId: integer("redeemed_order_id"),
    revenue: real("revenue").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("campaign_recipient_campaign_idx").on(t.campaignId)],
);

/** Simulated push/email/SMS. Rendered as the customer Inbox. */
export const notification = sqliteTable(
  "notification",
  {
    id: pk(),
    customerId: integer("customer_id").references(() => customer.id, {
      onDelete: "cascade",
    }),
    email: text("email"),
    orderId: integer("order_id").references(() => order.id, {
      onDelete: "cascade",
    }),
    campaignId: integer("campaign_id"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    channel: text("channel", { enum: ["email", "sms", "push", "in_app"] })
      .notNull()
      .default("in_app"),
    kind: text("kind", {
      enum: ["order", "campaign", "loyalty", "login", "voucher", "system"],
    })
      .notNull()
      .default("system"),
    href: text("href"),
    readAt: integer("read_at", { mode: "timestamp" }),
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("notification_customer_idx").on(t.customerId),
    index("notification_email_idx").on(t.email),
  ],
);

export const favorite = sqliteTable(
  "favorite",
  {
    id: pk(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItem.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("favorite_unique_idx").on(t.customerId, t.menuItemId)],
);

/* -------------------------------------------------------------------------- */
/*  Operations                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A physical table. Carries its own position on the branch floor plan so the
 * reservation picker and the staff floor view render from the same source —
 * coordinates are on a 0–100 grid, so the map scales to any screen width
 * without a second set of mobile numbers.
 */
export const restaurantTable = sqliteTable(
  "restaurant_table",
  {
    id: pk(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branch.id, { onDelete: "cascade" }),
    /** Unique within a branch, not globally — every outlet has a table 1. */
    number: integer("number").notNull(),
    label: text("label"),
    seats: integer("seats").notNull().default(2),
    zone: text("zone").notNull().default("Main Floor"),
    shape: text("shape", {
      enum: ["round", "square", "rect", "booth", "counter"],
    })
      .notNull()
      .default("square"),
    /** Percentage coordinates of the shape's centre on the floor plan. */
    x: real("x").notNull().default(50),
    y: real("y").notNull().default(50),
    /** Percentage dimensions of the shape. */
    w: real("w").notNull().default(10),
    h: real("h").notNull().default(10),
    /** Walk-in state, independent of future reservations. */
    status: text("status", {
      enum: ["free", "occupied", "reserved", "cleaning"],
    })
      .notNull()
      .default("free"),
    /** false for service stations and tables kept for walk-ins. */
    bookable: integer("bookable", { mode: "boolean" }).notNull().default(true),
    currentOrderId: integer("current_order_id"),
  },
  (t) => [
    uniqueIndex("restaurant_table_branch_number_idx").on(t.branchId, t.number),
    index("restaurant_table_branch_idx").on(t.branchId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Reservations                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A table booking. Availability is derived by overlapping [startsAt, endsAt)
 * against other reservations for the same table, so no slot table is needed
 * and the seating duration can vary per booking.
 */
export const reservation = sqliteTable(
  "reservation",
  {
    id: pk(),
    /** Human-facing reference, e.g. BC-R-4821. */
    reference: text("reference").notNull().unique(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branch.id, { onDelete: "cascade" }),
    tableId: integer("table_id")
      .notNull()
      .references(() => restaurantTable.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    /** Snapshotted so a later profile edit doesn't rewrite booking history. */
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    partySize: integer("party_size").notNull().default(2),
    /** Local calendar date, kept separate for cheap per-day queries. */
    date: text("date").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    status: text("status", {
      enum: [
        "confirmed",
        "seated",
        "completed",
        "cancelled",
        "no_show",
      ],
    })
      .notNull()
      .default("confirmed"),
    occasion: text("occasion", {
      enum: [
        "none",
        "birthday",
        "anniversary",
        "business",
        "date",
        "celebration",
      ],
    })
      .notNull()
      .default("none"),
    notes: text("notes"),
    /** Set when the party is seated and an order is opened on the table. */
    orderId: integer("order_id"),
    cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
    cancelReason: text("cancel_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("reservation_branch_date_idx").on(t.branchId, t.date),
    index("reservation_table_idx").on(t.tableId),
    index("reservation_customer_idx").on(t.customerId),
  ],
);

export const staffActivityLog = sqliteTable(
  "staff_activity_log",
  {
    id: pk(),
    userId: integer("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    userName: text("user_name").notNull().default("System"),
    action: text("action").notNull(),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("staff_log_created_idx").on(t.createdAt)],
);

/** Single-row business configuration (id = 1). */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey().default(1),
  restaurantName: text("restaurant_name").notNull().default("Bella Cucina"),
  tagline: text("tagline").notNull().default("Modern Italian, made to order"),
  currency: text("currency").notNull().default("MYR"),
  currencySymbol: text("currency_symbol").notNull().default("RM"),
  serviceChargeRate: real("service_charge_rate").notNull().default(0.1),
  /** Malaysian SST on prepared food is 6%. */
  taxRate: real("tax_rate").notNull().default(0.06),
  taxLabel: text("tax_label").notNull().default("SST"),
  address: text("address")
    .notNull()
    .default("Jalan Telawi 3, Bangsar Baru, Kuala Lumpur"),
  phone: text("phone").notNull().default("+60 3-2201 8845"),
  /** Reservation policy, shared across branches. */
  reservationSlotMinutes: integer("reservation_slot_minutes")
    .notNull()
    .default(30),
  reservationDurationMinutes: integer("reservation_duration_minutes")
    .notNull()
    .default(90),
  reservationMaxPartySize: integer("reservation_max_party_size")
    .notNull()
    .default(12),
  reservationLeadDays: integer("reservation_lead_days").notNull().default(60),
  openingHours: text("opening_hours", { mode: "json" })
    .$type<Record<string, { open: string; close: string; closed?: boolean }>>()
    .default({}),
  referralEnabled: integer("referral_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  referralValue: real("referral_value").notNull().default(10),
  pointsExpiryMonths: integer("points_expiry_months").notNull().default(18),
});

/* -------------------------------------------------------------------------- */

export type Branch = typeof branch.$inferSelect;
export type BranchMenuItem = typeof branchMenuItem.$inferSelect;
export type Reservation = typeof reservation.$inferSelect;
export type ReservationStatus = Reservation["status"];
export type DeliveryJob = typeof deliveryJob.$inferSelect;
export type DeliveryStatus = DeliveryJob["status"];
export type PaymentMethod = Order["paymentMethod"];
export type TableShape = RestaurantTable["shape"];
export type User = typeof user.$inferSelect;
export type Customer = typeof customer.$inferSelect;
export type Category = typeof category.$inferSelect;
export type MenuItem = typeof menuItem.$inferSelect;
export type ModifierGroup = typeof modifierGroup.$inferSelect;
export type ModifierOption = typeof modifierOption.$inferSelect;
export type Order = typeof order.$inferSelect;
export type OrderItem = typeof orderItem.$inferSelect;
export type DeliveryZone = typeof deliveryZone.$inferSelect;
export type Voucher = typeof voucher.$inferSelect;
export type CustomerVoucher = typeof customerVoucher.$inferSelect;
export type Promotion = typeof promotion.$inferSelect;
export type LoyaltyTier = typeof loyaltyTier.$inferSelect;
export type LoyaltyRedemption = typeof loyaltyRedemption.$inferSelect;
export type PointsLedger = typeof pointsLedger.$inferSelect;
export type Review = typeof review.$inferSelect;
export type Campaign = typeof campaign.$inferSelect;
export type Notification = typeof notification.$inferSelect;
export type RestaurantTable = typeof restaurantTable.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type OrderStatus = Order["status"];
export type OrderType = Order["type"];
export type Segment = Customer["segment"];
export type Role = User["role"];
