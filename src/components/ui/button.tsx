import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[.98]",
  {
    variants: {
      variant: {
        default:
          "bg-brand-700 text-white shadow-sm hover:bg-brand-800 hover:shadow-md",
        secondary:
          "bg-cream-300 text-ink-900 hover:bg-cream-400 border border-cream-400",
        outline:
          "border border-cream-500 bg-white/70 text-ink-900 hover:bg-cream-200 hover:border-brand-300",
        ghost: "text-ink-700 hover:bg-cream-300 hover:text-ink-900",
        destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
        success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
        gold: "bg-gold-500 text-ink-900 hover:bg-gold-600 shadow-sm",
        link: "text-brand-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-5",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-8 text-base font-semibold",
        icon: "size-10",
        iconSm: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
