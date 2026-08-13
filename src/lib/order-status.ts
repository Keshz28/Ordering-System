import type { OrderStatus, OrderType } from "@/db/schema";

/**
 * Pure order-status helpers with no database import, so client components
 * (KDS board, order tracker) can use them without pulling the libSQL client
 * into the browser bundle. Server code re-exports these from lib/orders.ts.
 */

export const STATUS_FLOW: OrderStatus[] = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "dispatched",
  "completed",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Received",
  accepted: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  dispatched: "Out for delivery",
  completed: "Completed",
  canceled: "Canceled",
  refunded: "Refunded",
};

/** Delivery adds a dispatch leg; the other order types skip it. */
export function stepsFor(type: OrderType): OrderStatus[] {
  return type === "delivery"
    ? ["accepted", "preparing", "ready", "dispatched", "completed"]
    : ["accepted", "preparing", "ready", "completed"];
}

export function nextStatus(current: OrderStatus, type: OrderType) {
  const steps = stepsFor(type);
  if (current === "new") return steps[0];
  const idx = steps.indexOf(current);
  if (idx < 0 || idx === steps.length - 1) return null;
  return steps[idx + 1];
}
