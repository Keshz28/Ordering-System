import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-brand-200 bg-brand-50 text-brand-800",
        neutral: "border-cream-400 bg-cream-200 text-ink-700",
        outline: "border-cream-500 bg-transparent text-ink-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        warning: "border-amber-200 bg-amber-50 text-amber-900",
        danger: "border-red-200 bg-red-50 text-red-700",
        info: "border-sky-200 bg-sky-50 text-sky-800",
        gold: "border-gold-400 bg-amber-50 text-amber-900",
        solid: "border-brand-700 bg-brand-700 text-white",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
