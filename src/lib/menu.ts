import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  category,
  menuItem,
  modifierGroup,
  modifierOption,
  order,
  orderItem,
  type Category,
  type MenuItem,
  type ModifierGroup,
  type ModifierOption,
} from "@/db/schema";
import { isWithinTimeWindow } from "./utils";

export type MenuItemWithMods = MenuItem & {
  groups: (ModifierGroup & { options: ModifierOption[] })[];
  soldOut: boolean;
  offSchedule: boolean;
};

export type MenuCategory = Category & { items: MenuItemWithMods[] };

/**
 * The whole menu in one shot, including modifier trees.
 * `storefront: true` hides items that are unavailable or outside their time
 * window; the admin and POS surfaces pass false so staff can still see them.
 */
export async function getMenu(
  { storefront = true }: { storefront?: boolean } = {},
): Promise<MenuCategory[]> {
  const [categories, items] = await Promise.all([
    db.select().from(category).orderBy(asc(category.sortOrder)),
    db
      .select()
      .from(menuItem)
      .orderBy(asc(menuItem.sortOrder), asc(menuItem.id)),
  ]);

  const groups = await db
    .select()
    .from(modifierGroup)
    .orderBy(asc(modifierGroup.sortOrder));
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
        .orderBy(asc(modifierOption.sortOrder))
    : [];

  const optionsByGroup = new Map<number, ModifierOption[]>();
  for (const o of options) {
    const list = optionsByGroup.get(o.groupId) ?? [];
    list.push(o);
    optionsByGroup.set(o.groupId, list);
  }

  const groupsByItem = new Map<number, (ModifierGroup & { options: ModifierOption[] })[]>();
  for (const g of groups) {
    const list = groupsByItem.get(g.menuItemId) ?? [];
    list.push({ ...g, options: optionsByGroup.get(g.id) ?? [] });
    groupsByItem.set(g.menuItemId, list);
  }

  const decorated: MenuItemWithMods[] = items.map((i) => ({
    ...i,
    groups: groupsByItem.get(i.id) ?? [],
    soldOut: i.stock !== null && i.stock <= 0,
    offSchedule: !isWithinTimeWindow(i.availableFrom, i.availableTo),
  }));

  return categories
    .filter((c) => (storefront ? c.active : true))
    .map((c) => ({
      ...c,
      items: decorated.filter(
        (i) =>
          i.categoryId === c.id &&
          (storefront ? i.isAvailable && !i.offSchedule : true),
      ),
    }))
    .filter((c) => (storefront ? c.items.length > 0 : true));
}

export async function getMenuItem(id: number) {
  const [item] = await db.select().from(menuItem).where(eq(menuItem.id, id));
  if (!item) return null;
  const groups = await db
    .select()
    .from(modifierGroup)
    .where(eq(modifierGroup.menuItemId, id))
    .orderBy(asc(modifierGroup.sortOrder));
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
        .orderBy(asc(modifierOption.sortOrder))
    : [];
  return {
    ...item,
    groups: groups.map((g) => ({
      ...g,
      options: options.filter((o) => o.groupId === g.id),
    })),
    soldOut: item.stock !== null && item.stock <= 0,
    offSchedule: !isWithinTimeWindow(item.availableFrom, item.availableTo),
  } satisfies MenuItemWithMods;
}

/** Units sold in the last 7 days, used for the admin "sold this week" chip. */
export async function unitsSoldThisWeek() {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const rows = await db
    .select({
      menuItemId: orderItem.menuItemId,
      units: sql<number>`sum(${orderItem.quantity})`,
    })
    .from(orderItem)
    .innerJoin(order, eq(orderItem.orderId, order.id))
    .where(sql`${order.placedAt} >= ${Math.floor(since.getTime() / 1000)}`)
    .groupBy(orderItem.menuItemId);
  return new Map(rows.map((r) => [r.menuItemId, Number(r.units) || 0]));
}

/** Powers the "Complete your meal" upsell shown after adding to cart. */
export async function upsellSuggestions(limit = 4) {
  const rows = await db
    .select({ item: menuItem, categoryName: category.name })
    .from(menuItem)
    .innerJoin(category, eq(menuItem.categoryId, category.id))
    .where(inArray(category.name, ["Starters", "Desserts", "Drinks"]))
    .orderBy(desc(menuItem.featured), asc(menuItem.price))
    .limit(limit);
  return rows.map((r) => r.item);
}
