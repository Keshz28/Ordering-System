import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { Receipt } from "lucide-react";
import { db } from "@/db";
import { order, orderItem } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { STATUS_LABELS } from "@/lib/orders";
import { formatDateTime, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/data";
import { ReorderButton } from "@/components/store/reorder-button";
import { ReviewForm } from "@/components/store/review-form";

export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const customer = await requireCustomer();

  const orders = await db
    .select()
    .from(order)
    .where(eq(order.customerId, customer.id))
    .orderBy(desc(order.placedAt));

  const items = orders.length
    ? await db
        .select()
        .from(orderItem)
        .where(
          inArray(
            orderItem.orderId,
            orders.map((o) => o.id),
          ),
        )
    : [];

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No orders yet"
        description="Once you order, everything shows up here with one-tap reorder."
        action={
          <Button asChild>
            <Link href="/menu">Browse the menu</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const lines = items.filter((i) => i.orderId === o.id);
        return (
          <article
            key={o.id}
            className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/order/${o.id}`}
                    className="font-display text-lg text-ink-900 hover:text-brand-700"
                  >
                    {o.number}
                  </Link>
                  <Badge
                    variant={
                      o.status === "completed"
                        ? "success"
                        : o.status === "canceled" || o.status === "refunded"
                          ? "danger"
                          : "info"
                    }
                  >
                    {STATUS_LABELS[o.status]}
                  </Badge>
                  <Badge variant="neutral" className="capitalize">
                    {o.type.replace("_", "-")}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {formatDateTime(o.placedAt)}
                  {o.voucherCode ? ` · voucher ${o.voucherCode}` : ""}
                  {o.pointsEarned > 0
                    ? ` · ${o.pointsEarned.toLocaleString()} points`
                    : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-display text-xl text-ink-900">
                  {money(o.total)}
                </span>
                <ReorderButton
                  lines={lines.map((l) => ({
                    menuItemId: l.menuItemId!,
                    name: l.name,
                    unitPrice: l.unitPrice,
                    quantity: l.quantity,
                    note: l.note,
                    modifiers: l.resolvedModifiers ?? [],
                  }))}
                />
              </div>
            </div>

            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-cream-300 pt-3 text-sm text-ink-700">
              {lines.map((l) => (
                <li key={l.id}>
                  <span className="font-medium text-ink-900">{l.quantity}×</span>{" "}
                  {l.name}
                  {(l.resolvedModifiers ?? []).length > 0 && (
                    <span className="text-xs text-ink-500">
                      {" "}
                      ({(l.resolvedModifiers ?? [])
                        .map((m) => m.optionName)
                        .join(", ")})
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {o.status === "completed" && (
              <ReviewForm orderId={o.id} orderNumber={o.number} />
            )}
          </article>
        );
      })}
    </div>
  );
}
