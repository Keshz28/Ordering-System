import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  Bell,
  Gift,
  Inbox as InboxIcon,
  KeyRound,
  Mail,
  Megaphone,
  Receipt,
  Sparkles,
} from "lucide-react";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/data";
import { MarkInboxRead } from "@/components/store/mark-inbox-read";

export const dynamic = "force-dynamic";

const KIND_META = {
  order: { icon: Receipt, label: "Order", variant: "info" as const },
  campaign: { icon: Megaphone, label: "Offer", variant: "default" as const },
  loyalty: { icon: Sparkles, label: "Rewards", variant: "gold" as const },
  login: { icon: KeyRound, label: "Security", variant: "neutral" as const },
  voucher: { icon: Gift, label: "Voucher", variant: "success" as const },
  system: { icon: Bell, label: "Notice", variant: "neutral" as const },
};

const CHANNEL_LABEL = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  in_app: "In-app",
};

export default async function InboxPage() {
  const customer = await requireCustomer();

  const messages = await db
    .select()
    .from(notification)
    .where(eq(notification.customerId, customer.id))
    .orderBy(desc(notification.sentAt))
    .limit(60);

  const unread = messages.filter((m) => !m.readAt).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink-900">Your inbox</h2>
          <p className="text-sm text-ink-500">
            Every order update, offer and sign-in code lands here — this is what
            stands in for email and SMS in the demo.
          </p>
        </div>
        {unread > 0 && <MarkInboxRead count={unread} />}
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="Nothing here yet"
          description="Place an order or redeem a reward and your notifications will show up."
        />
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => {
            const meta = KIND_META[m.kind] ?? KIND_META.system;
            const Icon = meta.icon;
            const body = (
              <div
                className={
                  m.readAt
                    ? "flex gap-3 rounded-card border border-cream-400 bg-white p-4"
                    : "flex gap-3 rounded-card border border-brand-200 bg-brand-50/40 p-4"
                }
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cream-200 text-brand-700">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink-900">{m.title}</p>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="flex items-center gap-1 text-xs text-ink-500">
                      <Mail className="size-3" />
                      {CHANNEL_LABEL[m.channel]}
                    </span>
                    {!m.readAt && (
                      <span className="size-2 rounded-full bg-brand-700" />
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-700">
                    {m.message}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {relativeTime(m.sentAt)}
                  </p>
                </div>
              </div>
            );

            return (
              <li key={m.id}>
                {m.href ? (
                  <Link href={m.href} className="block transition hover:opacity-90">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
