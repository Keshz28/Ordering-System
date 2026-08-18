import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  campaign,
  campaignRecipient,
  customer,
  pointsLedger,
  type Customer,
  type Segment,
} from "@/db/schema";
import { issueManualVoucher } from "./loyalty";
import { campaignEmail, emailEnabled, notify, sendEmail } from "./notify";
import { round2 } from "./utils";

/**
 * Campaign recipes — one-click retention plays.
 *
 * Each recipe knows who it targets, what it offers and why it exists. The
 * owner picks one, reviews the audience, and sends; the engine issues a
 * personal voucher to every recipient and records attribution so the campaign
 * detail page can show real ROI later.
 */
export type RecipeId =
  | "second_order"
  | "we_miss_you"
  | "birthday"
  | "slow_day"
  | "points_expiry"
  | "anniversary"
  | "frequency_ladder"
  | "high_aov"
  | "review_request"
  | "vip_preview";

export type Recipe = {
  id: RecipeId;
  name: string;
  rationale: string;
  segment: Segment | "all" | "custom";
  subject: string;
  body: string;
  voucher: {
    type: "percent_off" | "fixed_off" | "free_item" | "free_delivery";
    value: number;
    minSpend: number;
    expiryDays: number;
    title: string;
  } | null;
};

export const RECIPES: Recipe[] = [
  {
    id: "second_order",
    name: "Second-order nudge",
    rationale:
      "The gap between order one and two is where most guests are lost. Sent around day 10 with a reason to come back.",
    segment: "new",
    subject: "Ready for round two?",
    body: "Your first visit is the hard part — the second is where it becomes a habit. Here's 15% off anything on the menu, valid for the next two weeks.",
    voucher: {
      type: "percent_off",
      value: 15,
      minSpend: 0,
      expiryDays: 14,
      title: "15% off your second order",
    },
  },
  {
    id: "we_miss_you",
    name: "We miss you",
    rationale:
      "Win-back for guests who have gone quiet. Escalates from RM25 at 45 days to 20% at 75 days. Skips VIPs so you never discount your best customers.",
    segment: "dormant",
    subject: "It's been a while — here's something on us",
    body: "The oven has been busy but your table has been empty. Come back this month and take RM25 off whatever you fancy.",
    voucher: {
      type: "fixed_off",
      value: 8,
      minSpend: 25,
      expiryDays: 30,
      title: "RM25 off — we miss you",
    },
  },
  {
    id: "birthday",
    name: "Birthday reward",
    rationale:
      "Sent seven days before a birthday so there's time to book. The highest-converting automated message most restaurants run.",
    segment: "custom",
    subject: "Happy birthday from all of us",
    body: "Birthdays deserve a proper table. Here is RM30 towards yours — bring whoever you like.",
    voucher: {
      type: "fixed_off",
      value: 10,
      minSpend: 30,
      expiryDays: 21,
      title: "RM30 birthday reward",
    },
  },
  {
    id: "slow_day",
    name: "Slow-day booster",
    rationale:
      "Fills the quiet mid-week service by pushing demand into hours you're already staffed for.",
    segment: "repeat",
    subject: "Tuesday tables, 20% off",
    body: "Midweek is our favourite service — calmer room, same kitchen. Take 20% off any Tuesday or Wednesday booking this month.",
    voucher: {
      type: "percent_off",
      value: 20,
      minSpend: 25,
      expiryDays: 30,
      title: "20% off midweek",
    },
  },
  {
    id: "points_expiry",
    name: "Points about to expire",
    rationale:
      "Turns a liability on your books into a visit. Guests hate losing points more than they like earning them.",
    segment: "custom",
    subject: "Your points are about to expire",
    body: "You've got points sitting in your account that lapse soon. Redeem them for a voucher before they go.",
    voucher: null,
  },
  {
    id: "anniversary",
    name: "One year with us",
    rationale:
      "Recognises the anniversary of a guest's first order. Cheap to run, disproportionately memorable.",
    segment: "custom",
    subject: "A year since your first visit",
    body: "It's been a year since you first ate with us. Thank you — here's a free dessert on your next visit.",
    voucher: {
      type: "fixed_off",
      value: 9,
      minSpend: 25,
      expiryDays: 60,
      title: "Anniversary dessert on us",
    },
  },
  {
    id: "frequency_ladder",
    name: "Milestone reward",
    rationale:
      "Celebrates the 5th, 10th and 20th order. Gives regulars a reason to keep counting.",
    segment: "repeat",
    subject: "You've hit a milestone",
    body: "You've become a regular, and we noticed. Here's 10% off your next order as a thank you.",
    voucher: {
      type: "percent_off",
      value: 10,
      minSpend: 0,
      expiryDays: 45,
      title: "Milestone: 10% off",
    },
  },
  {
    id: "high_aov",
    name: "Big-table upsell",
    rationale:
      "Targets guests whose average order is well above the norm — they respond to experience, not discounts.",
    segment: "custom",
    subject: "First look: the chef's table",
    body: "You order like someone who enjoys the full experience. We're opening a six-seat chef's table on Fridays and wanted you to know first.",
    voucher: null,
  },
  {
    id: "review_request",
    name: "Ask for a review",
    rationale:
      "Requests a review from happy recent guests and pays 20 points for it. Builds the social proof that wins new customers.",
    segment: "repeat",
    subject: "How did we do?",
    body: "If you have thirty seconds, we'd love a quick review of your last order — it earns you 20 points either way.",
    voucher: null,
  },
  {
    id: "vip_preview",
    name: "VIP first look",
    rationale:
      "Rewards your top spenders with access rather than money. Protects margin while making them feel like insiders.",
    segment: "vip",
    subject: "You're first to see the new menu",
    body: "Truffle season starts next week. VIP members get first bookings before we announce it publicly.",
    voucher: null,
  },
];

export function getRecipe(id: string) {
  return RECIPES.find((r) => r.id === id) ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Audience resolution                                                       */
/* -------------------------------------------------------------------------- */

/** Resolves who a recipe or raw segment actually reaches, right now. */
export async function resolveAudience(
  segment: string,
  recipeId?: string,
): Promise<Customer[]> {
  if (recipeId === "birthday") {
    const all = await db.select().from(customer);
    const now = new Date();
    return all.filter((c) => {
      if (!c.birthday) return false;
      const [, m, d] = c.birthday.split("-").map(Number);
      const next = new Date(now.getFullYear(), (m || 1) - 1, d || 1);
      const days = Math.round((next.getTime() - now.getTime()) / 86_400_000);
      return days >= -1 && days <= 7;
    });
  }

  if (recipeId === "points_expiry") {
    const soon = new Date(Date.now() + 90 * 86_400_000);
    const rows = await db
      .select({ customerId: pointsLedger.customerId })
      .from(pointsLedger)
      .where(
        and(
          eq(pointsLedger.state, "active"),
          lte(pointsLedger.expiresAt, soon),
        ),
      )
      .groupBy(pointsLedger.customerId);
    if (rows.length === 0) return [];
    return db
      .select()
      .from(customer)
      .where(
        inArray(
          customer.id,
          rows.map((r) => r.customerId),
        ),
      );
  }

  if (recipeId === "high_aov") {
    return db.select().from(customer).where(eq(customer.highAov, true));
  }

  if (recipeId === "anniversary") {
    const all = await db.select().from(customer);
    const now = Date.now();
    return all.filter((c) => {
      const age = (now - c.createdAt.getTime()) / 86_400_000;
      return age >= 350 && age <= 380;
    });
  }

  if (recipeId === "frequency_ladder") {
    return db
      .select()
      .from(customer)
      .where(sql`${customer.orderCount} in (5, 10, 20)`);
  }

  if (recipeId === "review_request") {
    return db
      .select()
      .from(customer)
      .where(and(gte(customer.orderCount, 2), eq(customer.marketingOptIn, true)));
  }

  if (segment === "all") {
    return db.select().from(customer).where(eq(customer.marketingOptIn, true));
  }

  const audience = await db
    .select()
    .from(customer)
    .where(eq(customer.segment, segment as Segment));

  // Never discount a VIP through a win-back play — it just burns margin.
  if (recipeId === "we_miss_you") {
    return audience.filter((c) => c.segment !== "vip");
  }
  return audience;
}

/* -------------------------------------------------------------------------- */
/*  Sending                                                                   */
/* -------------------------------------------------------------------------- */

export async function sendCampaign(input: {
  name: string;
  recipeId?: string;
  segment: string;
  subject: string;
  body: string;
  channel: "email" | "sms" | "simulated";
  voucher?: {
    type: "percent_off" | "fixed_off" | "free_item" | "free_delivery";
    value: number;
    minSpend: number;
    expiryDays: number;
    title: string;
  } | null;
}) {
  const audience = await resolveAudience(input.segment, input.recipeId);

  const [created] = await db
    .insert(campaign)
    .values({
      name: input.name,
      recipe: input.recipeId ?? null,
      channel: input.channel,
      targetSegment: input.segment,
      subject: input.subject,
      body: input.body,
      status: "sent",
      recipients: audience.length,
      sentAt: new Date(),
    })
    .returning();

  let discountCost = 0;

  for (const person of audience) {
    let code: string | undefined;

    if (input.voucher) {
      const issued = await issueManualVoucher({
        customerId: person.id,
        type: input.voucher.type,
        value: input.voucher.value,
        minSpend: input.voucher.minSpend,
        expiryDays: input.voucher.expiryDays,
        title: input.voucher.title,
        source: "campaign",
        campaignId: created.id,
        notifyCustomer: false,
      });
      code = issued.code;
      // Budgeted exposure, not spend — only redeemed vouchers actually cost.
      discountCost += input.voucher.type === "fixed_off" ? input.voucher.value : 0;
    }

    await db.insert(campaignRecipient).values({
      campaignId: created.id,
      customerId: person.id,
    });

    await notify({
      customerId: person.id,
      campaignId: created.id,
      kind: "campaign",
      channel: input.channel === "simulated" ? "in_app" : input.channel,
      title: input.subject,
      message: code
        ? `${input.body}\n\nYour code: ${code}`
        : input.body,
      href: code ? "/account/offers" : "/menu",
    });

    if (input.channel === "email" && emailEnabled()) {
      await sendEmail({
        to: person.email,
        subject: input.subject,
        html: campaignEmail(input.subject, input.body, code),
      });
    }
  }

  await db
    .update(campaign)
    .set({ discountCost: round2(discountCost) })
    .where(eq(campaign.id, created.id));

  return { campaignId: created.id, recipients: audience.length };
}

/**
 * Recomputes engagement + attribution for a sent campaign.
 * Attribution rule: an order counts if the recipient ordered after the send
 * date using a voucher issued by this campaign.
 */
export async function refreshCampaignStats(campaignId: number) {
  const [row] = await db
    .select()
    .from(campaign)
    .where(eq(campaign.id, campaignId));
  if (!row) return null;

  const recipients = await db
    .select()
    .from(campaignRecipient)
    .where(eq(campaignRecipient.campaignId, campaignId));

  const redeemed = recipients.filter((r) => r.redeemedOrderId).length;
  const revenue = round2(recipients.reduce((s, r) => s + r.revenue, 0));

  await db
    .update(campaign)
    .set({ redeemed, revenue })
    .where(eq(campaign.id, campaignId));

  return { redeemed, revenue };
}
