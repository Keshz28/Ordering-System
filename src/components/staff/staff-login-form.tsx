"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const DEMO_ACCOUNTS = [
  { email: "owner@bellacucina.demo", role: "Owner", scope: "Everything" },
  { email: "manager@bellacucina.demo", role: "Manager", scope: "Orders, menu, CRM" },
  { email: "cashier@bellacucina.demo", role: "Cashier", scope: "POS + KDS" },
  { email: "kitchen@bellacucina.demo", role: "Kitchen", scope: "KDS only" },
];

export function StaffLoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("owner@bellacucina.demo");
  const [password, setPassword] = React.useState("demo1234");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed.");
        return;
      }
      toast.success(`Welcome, ${data.name}`);
      router.push(next ?? data.home);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-cream-400 bg-white p-6 shadow-[var(--shadow-card)]">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Work email" htmlFor="staff-email">
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </Field>

        <Field label="Password" htmlFor="staff-password" error={error}>
          <Input
            id="staff-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Signing in…
            </>
          ) : (
            <>
              <LogIn className="size-4" /> Sign in
            </>
          )}
        </Button>
      </form>

      <div className="mt-5 border-t border-cream-300 pt-4">
        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
          Demo accounts · password demo1234
        </p>
        <div className="mt-2 grid gap-1">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => {
                setEmail(a.email);
                setPassword("demo1234");
              }}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-cream-200"
            >
              <span className="font-mono text-xs text-ink-700">{a.email}</span>
              <span className="text-[11px] text-ink-500">{a.scope}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
