import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-accent text-white shadow-[0_10px_30px_rgba(124,143,240,.22)] hover:-translate-y-0.5 hover:bg-accent2",
      secondary: "border border-white/10 bg-white/[0.05] text-white hover:-translate-y-0.5 hover:border-accent/30 hover:bg-white/[0.08]",
      ghost: "text-muted hover:bg-white/[0.05] hover:text-white",
      danger: "border border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/15"
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-8 rounded-lg px-3 text-xs",
      lg: "h-12 rounded-2xl px-6",
      icon: "h-10 w-10 p-0"
    }
  },
  defaultVariants: { variant: "default", size: "default" }
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
