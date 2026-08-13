"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyCode({
  code,
  compact,
}: {
  code: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          toast.success(`${code} copied`);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.info(`Your code is ${code}`);
        }
      }}
      className={cn(
        "group mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50 px-3 text-brand-800 transition hover:bg-brand-100",
        compact ? "py-1.5" : "py-2.5",
      )}
    >
      <span
        className={cn(
          "font-mono font-bold tracking-wider",
          compact ? "text-sm" : "text-base",
        )}
      >
        {code}
      </span>
      {copied ? (
        <Check className="size-4 text-emerald-600" />
      ) : (
        <Copy className="size-4 opacity-50 transition group-hover:opacity-100" />
      )}
    </button>
  );
}
