"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Info,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * Passwordless customer sign-in. Email -> 6-digit code -> session.
 * When no email provider is configured the code is displayed inline, which is
 * what makes this demo-able on a client's phone with no setup.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [stage, setStage] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [demoCode, setDemoCode] = React.useState<string | null>(null);
  const [emailSent, setEmailSent] = React.useState(false);
  const [isNew, setIsNew] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/customer/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send a code.");
        return;
      }
      setDemoCode(data.code);
      setEmailSent(data.emailSent);
      setIsNew(data.isNewCustomer);
      setStage("code");
      setSeconds(30);
      if (data.emailSent) toast.success(`Code sent to ${email}`);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/customer/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That didn't work.");
        return;
      }

      if (data.claimedOrders > 0) {
        toast.success(
          `Welcome back — we found ${data.claimedOrders} past order${
            data.claimedOrders === 1 ? "" : "s"
          } and credited ${data.claimedPoints.toLocaleString()} points.`,
          { duration: 6000 },
        );
      } else {
        toast.success(`Signed in as ${data.customer.name}`);
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-card border border-cream-400 bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
        {stage === "email" ? (
          <form onSubmit={requestCode}>
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Mail className="size-5" />
            </span>
            <h1 className="mt-4 font-display text-2xl text-ink-900">
              Sign in with your email
            </h1>
            <p className="mt-1.5 text-sm text-ink-500">
              No password needed. We&apos;ll send you a 6-digit code that works
              for 10 minutes.
            </p>

            <div className="mt-6">
              <Field label="Email address" htmlFor="login-email" error={error}>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </Field>
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-4 w-full"
              disabled={busy || !email.includes("@")}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sending…
                </>
              ) : (
                "Send me a code"
              )}
            </Button>

            <p className="mt-4 flex items-start gap-2 rounded-xl bg-cream-100 px-3.5 py-3 text-xs leading-relaxed text-ink-500">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
              Any email works in this demo — including your own. Orders you
              placed as a guest with the same address are matched to your account
              automatically.
            </p>
          </form>
        ) : (
          <form onSubmit={verify}>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setCode("");
                setError(null);
              }}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
            >
              <ArrowLeft className="size-4" /> Change email
            </button>

            <h1 className="font-display text-2xl text-ink-900">
              {isNew ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-sm text-ink-500">
              {emailSent ? (
                <>
                  We emailed a code to{" "}
                  <strong className="text-ink-900">{email}</strong>.
                </>
              ) : (
                <>
                  Your code is ready for{" "}
                  <strong className="text-ink-900">{email}</strong>.
                </>
              )}
            </p>

            {demoCode && (
              <div className="mt-5 rounded-2xl border border-dashed border-brand-300 bg-brand-50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Badge variant="default">Demo mode</Badge>
                </div>
                <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-brand-800">
                  {demoCode}
                </p>
                <p className="mt-2 flex items-start gap-1.5 text-left text-xs text-ink-500">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  In production this arrives by email. Set{" "}
                  <code className="rounded bg-white px-1">RESEND_API_KEY</code>{" "}
                  and the same code is sent for real — the code also lands in
                  your in-app Inbox either way.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setCode(demoCode)}
                >
                  Fill it in for me
                </Button>
              </div>
            )}

            <div className="mt-5">
              <Field label="6-digit code" htmlFor="login-code" error={error}>
                <Input
                  id="login-code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  className="text-center font-mono text-xl tracking-[0.4em]"
                />
              </Field>
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-4 w-full"
              disabled={busy || code.length < 6}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  <Check className="size-4" /> Sign in
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={() => requestCode()}
              disabled={seconds > 0 || busy}
              className="mt-3 w-full text-xs font-medium text-ink-500 transition hover:text-brand-700 disabled:opacity-50"
            >
              {seconds > 0 ? `Resend code in ${seconds}s` : "Resend the code"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ink-500">
        Restaurant staff?{" "}
        <Link
          href="/staff/login"
          className="font-medium text-brand-700 underline underline-offset-2"
        >
          Sign in to the back office
        </Link>
      </p>
    </div>
  );
}
