import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrderWithItems } from "@/lib/orders";
import { syncStripePayment, stripeEnabled } from "@/lib/payments";
import { OrderTracker } from "@/components/store/order-tracker";
import { DeliveryTracker } from "@/components/store/delivery-tracker";
import { deliveryFor } from "@/lib/delivery";

export const metadata: Metadata = { title: "Your order" };
export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string; paid?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  // Returning from Stripe Checkout — reconcile before the first paint.
  if (query.paid && stripeEnabled()) await syncStripePayment(orderId);

  const order = await getOrderWithItems(orderId);
  if (!order) notFound();

  const delivery =
    order.type === "delivery" ? await deliveryFor(orderId) : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <OrderTracker
        initialOrder={order}
        justPlaced={Boolean(query.placed || query.paid)}
      />
      {delivery && <DeliveryTracker job={delivery} />}
    </div>
  );
}
