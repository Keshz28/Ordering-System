import type { Metadata } from "next";
import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { Download, Receipt } from "lucide-react";
import { db } from "@/db";
import { order, orderItem } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { STATUS_LABELS } from "@/lib/orders";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments";
import { formatDateTime, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/data";
import { OrderActions } from "@/components/admin/order-actions";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireStaff("admin");
  const { status } = await searchParams;

  const rows = await db
    .select()
    .from(order)
    .orderBy(desc(order.placedAt))
    .limit(120);

  const filtered = status ? rows.filter((r) => r.status === status) : rows;

  const items = filtered.length
    ? await db
        .select()
        .from(orderItem)
        .where(
          inArray(
            orderItem.orderId,
            filtered.map((o) => o.id),
          ),
        )
    : [];

  const statuses = [
    "all",
    "new",
    "accepted",
    "preparing",
    "ready",
    "completed",
    "canceled",
    "refunded",
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description={`${filtered.length} of the last ${rows.length} orders`}
        actions={
          <Button variant="outline" asChild>
            <a href="/api/admin/export?type=orders" download>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {statuses.map((s) => {
          const active = s === "all" ? !status : status === s;
          return (
            <Link
              key={s}
              href={s === "all" ? "/admin/orders" : `/admin/orders?status=${s}`}
              className={
                active
                  ? "rounded-full bg-brand-700 px-3.5 py-1.5 text-sm font-medium text-white"
                  : "rounded-full border border-cream-400 bg-white px-3.5 py-1.5 text-sm font-medium text-ink-700 transition hover:border-brand-300"
              }
            >
              {s === "all" ? "All" : STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No orders match that filter"
          description="Try a different status."
        />
      ) : (
        <DataTable>
          <Thead>
            <tr>
              <Th>Order</Th>
              <Th>Placed</Th>
              <Th>Customer</Th>
              <Th>Items</Th>
              <Th>Channel</Th>
              <Th>Payment</Th>
              <Th className="text-right">Total</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </Thead>
          <Tbody>
            {filtered.map((o) => {
              const lines = items.filter((i) => i.orderId === o.id);
              return (
                <Tr key={o.id}>
                  <Td>
                    <Link
                      href={`/order/${o.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {o.number}
                    </Link>
                    {o.voucherCode && (
                      <span className="mt-0.5 block font-mono text-[11px] text-emerald-700">
                        {o.voucherCode} −{money(o.discountAmount)}
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs whitespace-nowrap">
                    {formatDateTime(o.placedAt)}
                  </Td>
                  <Td>
                    <span className="block text-sm">{o.guestName}</span>
                    <span className="block text-xs text-ink-500">
                      {o.guestEmail}
                    </span>
                  </Td>
                  <Td className="max-w-56 text-xs">
                    {lines
                      .slice(0, 2)
                      .map((l) => `${l.quantity}× ${l.name}`)
                      .join(", ")}
                    {lines.length > 2 && ` +${lines.length - 2} more`}
                  </Td>
                  <Td>
                    <Badge variant="neutral" className="capitalize">
                      {o.type.replace("_", "-")}
                    </Badge>
                    {o.tableNumber && (
                      <span className="ml-1 text-xs text-ink-500">
                        T{o.tableNumber}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="block text-xs">
                      {PAYMENT_METHOD_LABELS[o.paymentMethod]}
                    </span>
                    <Badge
                      variant={
                        o.paymentStatus === "captured"
                          ? "success"
                          : o.paymentStatus === "refunded"
                            ? "danger"
                            : "warning"
                      }
                      className="mt-0.5"
                    >
                      {o.paymentStatus}
                    </Badge>
                  </Td>
                  <Td className="text-right font-semibold whitespace-nowrap text-ink-900">
                    {money(o.total)}
                  </Td>
                  <Td>
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
                  </Td>
                  <Td>
                    <OrderActions
                      orderId={o.id}
                      status={o.status}
                      canRefund={["owner", "manager"].includes(session.role)}
                    />
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </DataTable>
      )}
    </div>
  );
}
