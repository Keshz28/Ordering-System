import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  category,
  menuItem,
  modifierGroup,
  modifierOption,
} from "@/db/schema";
import { logActivity, staffGuard } from "@/lib/auth";

export const runtime = "nodejs";

const itemSchema = z.object({
  id: z.number().optional(),
  categoryId: z.number(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().min(0),
  image: z.string().nullable().optional(),
  allergens: z.array(z.string()).optional(),
  prepMinutes: z.number().min(1).max(120).optional(),
  isAvailable: z.boolean().optional(),
  availableFrom: z.string().nullable().optional(),
  availableTo: z.string().nullable().optional(),
  featured: z.boolean().optional(),
  stock: z.number().nullable().optional(),
});

const patchSchema = z.discriminatedUnion("entity", [
  z.object({
    entity: z.literal("item"),
    id: z.number(),
    patch: itemSchema.partial().omit({ id: true }),
  }),
  z.object({
    entity: z.literal("category"),
    id: z.number(),
    patch: z.object({
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      sortOrder: z.number().optional(),
      active: z.boolean().optional(),
    }),
  }),
  z.object({
    entity: z.literal("group"),
    id: z.number(),
    patch: z.object({
      name: z.string().optional(),
      selectionType: z.enum(["single", "multi"]).optional(),
      required: z.boolean().optional(),
      minSelection: z.number().optional(),
      maxSelection: z.number().optional(),
    }),
  }),
  z.object({
    entity: z.literal("option"),
    id: z.number(),
    patch: z.object({
      name: z.string().optional(),
      priceDelta: z.number().optional(),
    }),
  }),
]);

export async function PATCH(request: Request) {
  const staff = await staffGuard("admin");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  const { entity, id, patch } = parsed.data;

  if (entity === "item") {
    await db.update(menuItem).set(patch).where(eq(menuItem.id, id));
    await logActivity("Updated menu item", `#${id} ${JSON.stringify(patch)}`);
  } else if (entity === "category") {
    await db.update(category).set(patch).where(eq(category.id, id));
    await logActivity("Updated category", `#${id}`);
  } else if (entity === "group") {
    await db.update(modifierGroup).set(patch).where(eq(modifierGroup.id, id));
    await logActivity("Updated modifier group", `#${id}`);
  } else {
    await db.update(modifierOption).set(patch).where(eq(modifierOption.id, id));
    await logActivity("Updated modifier option", `#${id}`);
  }

  return NextResponse.json({ ok: true });
}

const createSchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("item"), data: itemSchema }),
  z.object({
    entity: z.literal("category"),
    data: z.object({
      name: z.string().min(1),
      description: z.string().nullable().optional(),
    }),
  }),
  z.object({
    entity: z.literal("group"),
    data: z.object({
      menuItemId: z.number(),
      name: z.string().min(1),
      selectionType: z.enum(["single", "multi"]),
      required: z.boolean(),
      minSelection: z.number(),
      maxSelection: z.number(),
    }),
  }),
  z.object({
    entity: z.literal("option"),
    data: z.object({
      groupId: z.number(),
      name: z.string().min(1),
      priceDelta: z.number(),
    }),
  }),
]);

export async function POST(request: Request) {
  const staff = await staffGuard("admin");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  if (parsed.data.entity === "item") {
    const [row] = await db
      .insert(menuItem)
      .values(parsed.data.data)
      .returning();
    await logActivity("Created menu item", row.name);
    return NextResponse.json(row);
  }

  if (parsed.data.entity === "category") {
    const existing = await db.select({ id: category.id }).from(category);
    const [row] = await db
      .insert(category)
      .values({ ...parsed.data.data, sortOrder: existing.length })
      .returning();
    await logActivity("Created category", row.name);
    return NextResponse.json(row);
  }

  if (parsed.data.entity === "group") {
    const [row] = await db
      .insert(modifierGroup)
      .values(parsed.data.data)
      .returning();
    await logActivity("Created modifier group", row.name);
    return NextResponse.json(row);
  }

  const [row] = await db
    .insert(modifierOption)
    .values(parsed.data.data)
    .returning();
  await logActivity("Created modifier option", row.name);
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const staff = await staffGuard("admin");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { entity, id } = await request.json();
  if (entity === "option") {
    await db.delete(modifierOption).where(eq(modifierOption.id, Number(id)));
  } else if (entity === "group") {
    await db.delete(modifierGroup).where(eq(modifierGroup.id, Number(id)));
  } else if (entity === "item") {
    // Historical order lines keep their own name/price snapshot, so removing
    // an item never rewrites the past — but we soft-delete to be safe.
    await db
      .update(menuItem)
      .set({ isAvailable: false })
      .where(eq(menuItem.id, Number(id)));
  } else {
    return NextResponse.json({ error: "Unsupported." }, { status: 400 });
  }

  await logActivity("Removed menu entity", `${entity} #${id}`);
  return NextResponse.json({ ok: true });
}
