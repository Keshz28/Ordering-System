import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Star } from "lucide-react";
import { db } from "@/db";
import { customer, order, review } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { ReviewReply } from "@/components/admin/review-reply";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string }>;
}) {
  await requireStaff("admin");
  const { rating } = await searchParams;

  const rows = await db
    .select({ review, customer, order })
    .from(review)
    .leftJoin(customer, eq(review.customerId, customer.id))
    .leftJoin(order, eq(review.orderId, order.id))
    .orderBy(desc(review.createdAt));

  const filtered = rating
    ? rows.filter((r) => r.review.rating === Number(rating))
    : rows;

  const average = rows.length
    ? rows.reduce((s, r) => s + r.review.rating, 0) / rows.length
    : 0;
  const unanswered = rows.filter(
    (r) => !r.review.reply && r.review.rating <= 3,
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reviews"
        description="Reply to a review and the customer sees it in their inbox."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Average rating"
          value={average.toFixed(2)}
          sub={`${rows.length} reviews`}
          icon={Star}
          tone="brand"
        />
        <StatCard
          label="5-star reviews"
          value={rows.filter((r) => r.review.rating === 5).length}
          sub={
            rows.length
              ? `${Math.round(
                  (rows.filter((r) => r.review.rating === 5).length /
                    rows.length) *
                    100,
                )}% of all reviews`
              : undefined
          }
        />
        <StatCard
          label="Needs a reply"
          value={unanswered}
          sub="3 stars or below, no response yet"
          tone={unanswered > 0 ? "warning" : "success"}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["all", "5", "4", "3", "2", "1"].map((r) => {
          const active = r === "all" ? !rating : rating === r;
          return (
            <Link
              key={r}
              href={r === "all" ? "/admin/reviews" : `/admin/reviews?rating=${r}`}
              className={
                active
                  ? "rounded-full bg-brand-700 px-3.5 py-1.5 text-sm font-medium text-white"
                  : "rounded-full border border-cream-400 bg-white px-3.5 py-1.5 text-sm font-medium text-ink-700 transition hover:border-brand-300"
              }
            >
              {r === "all" ? "All ratings" : `${r} ★`}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No reviews match"
          description="Try a different rating filter."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(({ review: r, customer: c, order: o }) => (
            <article
              key={r.id}
              className="rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-gold-500">
                      {"★".repeat(r.rating)}
                      <span className="text-cream-500">
                        {"★".repeat(5 - r.rating)}
                      </span>
                    </span>
                    {c && (
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="text-sm font-medium text-ink-900 hover:text-brand-700"
                      >
                        {c.name}
                      </Link>
                    )}
                    {o && (
                      <Link
                        href={`/order/${o.id}`}
                        className="font-mono text-xs text-ink-500 hover:text-brand-700"
                      >
                        {o.number}
                      </Link>
                    )}
                    {r.rating <= 3 && !r.reply && (
                      <Badge variant="warning">Needs a reply</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-ink-700">“{r.comment}”</p>
                </div>
                <span className="text-xs whitespace-nowrap text-ink-500">
                  {formatDate(r.createdAt)}
                </span>
              </div>

              {r.reply ? (
                <div className="mt-3 rounded-xl bg-cream-100 px-3.5 py-2.5">
                  <p className="text-xs font-semibold text-ink-900">
                    Bella Cucina replied {formatDate(r.repliedAt)}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-700">{r.reply}</p>
                </div>
              ) : (
                <ReviewReply reviewId={r.id} />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
