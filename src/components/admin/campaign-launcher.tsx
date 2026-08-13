"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Send, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import type { Recipe } from "@/lib/campaigns";
import { SEGMENT_LABELS } from "@/lib/segment-labels";
import { cn, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Audience = {
  count: number;
  sample: {
    id: number;
    name: string;
    email: string;
    segment: string;
    totalSpent: number;
  }[];
};

/**
 * Recipe-first campaign builder: the owner picks a retention play, sees exactly
 * who it reaches right now, edits the copy if they want, and sends.
 */
export function CampaignLauncher({
  recipes,
  segments,
  emailLive,
}: {
  recipes: Recipe[];
  segments: { segment: string; customers: number }[];
  emailLive: boolean;
}) {
  const [active, setActive] = React.useState<Recipe | null>(null);

  const segmentCount = new Map(segments.map((s) => [s.segment, s.customers]));

  return (
    <>
      <section>
        <h2 className="font-display text-xl text-ink-900">Campaign recipes</h2>
        <p className="mb-3 text-sm text-ink-500">
          Each one pre-fills the audience, the message and the offer. Pick one,
          check who it reaches, send.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setActive(recipe)}
              className="flex flex-col rounded-card border border-cream-400 bg-white p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[var(--shadow-lift)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Sparkles className="size-4" />
                </span>
                <div className="flex flex-wrap justify-end gap-1">
                  <Badge variant="neutral" className="capitalize">
                    {recipe.segment === "custom"
                      ? "Smart audience"
                      : recipe.segment === "all"
                        ? "Everyone"
                        : SEGMENT_LABELS[
                            recipe.segment as keyof typeof SEGMENT_LABELS
                          ]}
                  </Badge>
                  {recipe.voucher && (
                    <Badge variant="gold">
                      {recipe.voucher.type === "percent_off"
                        ? `${recipe.voucher.value}% off`
                        : recipe.voucher.type === "fixed_off"
                          ? `${money(recipe.voucher.value)} off`
                          : "Offer"}
                    </Badge>
                  )}
                </div>
              </div>

              <p className="mt-2.5 font-medium text-ink-900">{recipe.name}</p>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-500">
                {recipe.rationale}
              </p>

              {recipe.segment !== "custom" && recipe.segment !== "all" && (
                <p className="mt-2.5 flex items-center gap-1.5 text-xs text-ink-500">
                  <Users className="size-3.5" />
                  {segmentCount.get(recipe.segment) ?? 0} customers in this
                  segment today
                </p>
              )}
            </button>
          ))}
        </div>
      </section>

      <CampaignDialog
        recipe={active}
        emailLive={emailLive}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function CampaignDialog({
  recipe,
  emailLive,
  onClose,
}: {
  recipe: Recipe | null;
  emailLive: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [segment, setSegment] = React.useState("all");
  const [channel, setChannel] = React.useState<"simulated" | "email" | "sms">(
    "simulated",
  );
  const [includeVoucher, setIncludeVoucher] = React.useState(true);
  const [audience, setAudience] = React.useState<Audience | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!recipe) return;
    // Deliberate: syncing local state to a prop/storage change after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(recipe.name);
    setSubject(recipe.subject);
    setBody(recipe.body);
    setSegment(recipe.segment === "custom" ? "custom" : recipe.segment);
    setIncludeVoucher(Boolean(recipe.voucher));
    setAudience(null);
  }, [recipe]);

  // Resolve the live audience whenever the recipe opens or the segment changes.
  React.useEffect(() => {
    if (!recipe) return;
    let cancelled = false;
    // Deliberate: syncing local state to a prop/storage change after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/admin/campaigns", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "preview",
            recipeId: recipe.id,
            segment,
          }),
        });
        const data = await res.json();
        if (!cancelled && res.ok) setAudience(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipe, segment]);

  if (!recipe) return null;
  const play = recipe;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="center" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{play.name}</DialogTitle>
          <DialogDescription>{play.rationale}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3.5 overflow-y-auto px-5 pb-4">
          {/* --------------------------- audience --------------------------- */}
          <div className="rounded-xl border border-cream-400 bg-cream-100 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                <Users className="size-4" /> Audience
              </p>
              {loading ? (
                <Loader2 className="size-4 animate-spin text-ink-500" />
              ) : (
                <Badge variant={audience?.count ? "success" : "warning"}>
                  {audience?.count ?? 0} recipients
                </Badge>
              )}
            </div>

            {play.segment !== "custom" && (
              <NativeSelect
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="mt-2"
              >
                <option value="all">Everyone opted in</option>
                <option value="new">New</option>
                <option value="repeat">Repeat</option>
                <option value="vip">VIP</option>
                <option value="at_risk">At risk</option>
                <option value="dormant">Dormant</option>
              </NativeSelect>
            )}

            {play.segment === "custom" && (
              <p className="mt-1.5 text-xs text-ink-500">
                This recipe computes its own audience — birthdays, expiring
                points, anniversaries or spend behaviour.
              </p>
            )}

            {audience && audience.sample.length > 0 && (
              <ul className="mt-2.5 space-y-1">
                {audience.sample.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-ink-700">
                      {c.name}{" "}
                      <span className="text-ink-500">({c.email})</span>
                    </span>
                    <span className="shrink-0 text-ink-500">
                      {money(c.totalSpent)}
                    </span>
                  </li>
                ))}
                {audience.count > audience.sample.length && (
                  <li className="text-xs text-ink-500">
                    +{audience.count - audience.sample.length} more
                  </li>
                )}
              </ul>
            )}

            {audience?.count === 0 && (
              <p className="mt-2 text-xs text-amber-800">
                Nobody matches right now. Try another segment — dormant and
                at-risk fill up as the demo data ages.
              </p>
            )}
          </div>

          {/* ---------------------------- message --------------------------- */}
          <Field label="Campaign name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Subject line">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-28"
            />
          </Field>

          {/* ----------------------------- offer ---------------------------- */}
          {play.voucher && (
            <label className="flex items-start gap-3 rounded-xl border border-cream-400 px-3.5 py-3">
              <Switch
                checked={includeVoucher}
                onCheckedChange={setIncludeVoucher}
              />
              <span className="text-sm text-ink-700">
                Attach the offer: <strong>{play.voucher.title}</strong>
                <span className="block text-xs text-ink-500">
                  Single-use, locked to each recipient, expires in{" "}
                  {play.voucher.expiryDays} days
                  {play.voucher.minSpend > 0
                    ? `, min spend ${money(play.voucher.minSpend)}`
                    : ""}
                  .
                </span>
              </span>
            </label>
          )}

          {/* ---------------------------- channel --------------------------- */}
          <Field
            label="Channel"
            hint={
              emailLive
                ? "Resend is configured — email goes out for real."
                : "No RESEND_API_KEY, so everything lands in the customer's in-app Inbox."
            }
          >
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["simulated", "In-app"],
                  ["email", "Email"],
                  ["sms", "SMS"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setChannel(value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                    channel === value
                      ? "border-brand-600 bg-brand-50 text-brand-800"
                      : "border-cream-400 bg-white text-ink-500",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="flex gap-2 border-t border-cream-400 p-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={sending || loading || !audience?.count}
            onClick={async () => {
              setSending(true);
              try {
                const res = await fetch("/api/admin/campaigns", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    action: "send",
                    recipeId: play.id,
                    name,
                    segment,
                    subject,
                    body,
                    channel,
                    includeVoucher,
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  toast.error(data.error ?? "Couldn't send that campaign.");
                  return;
                }
                toast.success(
                  `Sent to ${data.recipients} customers — check their inboxes.`,
                  { duration: 6000 },
                );
                onClose();
                router.refresh();
              } finally {
                setSending(false);
              }
            }}
          >
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                {channel === "email" ? (
                  <Mail className="size-4" />
                ) : (
                  <Send className="size-4" />
                )}
                Send to {audience?.count ?? 0}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
