import type { Metadata } from "next";
import { and, eq, gt, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { deliveryZone, restaurantTable, voucher } from "@/db/schema";
import { currentCustomer } from "@/lib/auth";
import { offersFor } from "@/lib/loyalty";
import { CheckoutFlow } from "@/components/store/checkout-flow";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const customer = await currentCustomer();

  const [zones, tables, publicVouchers] = await Promise.all([
    db
      .select()
      .from(deliveryZone)
      .where(eq(deliveryZone.active, true))
      .orderBy(deliveryZone.fee),
    db.select().from(restaurantTable).orderBy(restaurantTable.number),
    db
      .select()
      .from(voucher)
      .where(
        and(
          eq(voucher.active, true),
          eq(voucher.targeted, false),
          or(isNull(voucher.validTo), gt(voucher.validTo, new Date())),
        ),
      ),
  ]);

  // Personal offers first — they're the ones the owner just issued in the demo.
  const personal = customer ? await offersFor(customer.id) : [];
  const suggested = [
    ...personal
      .filter((o) => !o.expired && !o.used)
      .map((o) => ({
        code: o.voucher.code,
        title: o.voucher.title,
        minSpend: o.voucher.minSpend,
      })),
    ...publicVouchers.map((v) => ({
      code: v.code,
      title: v.title,
      minSpend: v.minSpend,
    })),
  ].slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl text-ink-900">Checkout</h1>
      <p className="mt-1 mb-6 text-sm text-ink-500">
        Five quick steps and the kitchen gets to work.
      </p>

      <CheckoutFlow
        zones={zones}
        tables={tables}
        customer={
          customer
            ? {
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
              }
            : null
        }
        suggestedVouchers={suggested}
      />
    </div>
  );
}
