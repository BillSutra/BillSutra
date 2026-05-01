import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex max-w-full items-center justify-center gap-2 truncate rounded-xl text-sm font-medium transition-[transform,background-color,border-color,color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.99]",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_14px_28px_-18px_rgba(37,99,235,0.44)] hover:from-blue-700 hover:to-sky-600 hover:shadow-[0_18px_34px_-18px_rgba(37,99,235,0.5)] dark:from-blue-600 dark:to-sky-500 dark:text-white dark:hover:from-blue-500 dark:hover:to-sky-400",
        default:
          "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_14px_28px_-18px_rgba(37,99,235,0.44)] hover:from-blue-700 hover:to-sky-600 hover:shadow-[0_18px_34px_-18px_rgba(37,99,235,0.5)] dark:from-blue-600 dark:to-sky-500 dark:text-white dark:hover:from-blue-500 dark:hover:to-sky-400",
        danger:
          "border border-red-200 bg-red-50 text-red-700 shadow-sm hover:border-red-300 hover:bg-red-100 hover:shadow-md focus-visible:ring-red-500/30 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 hover:shadow-md focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-blue-200 hover:bg-blue-50/70 hover:text-slate-950 hover:shadow-[0_12px_24px_-20px_rgba(15,23,42,0.14)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/88 hover:shadow-[0_12px_24px_-20px_rgba(37,99,235,0.18)] dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700",
        ghost:
          "hover:bg-accent/70 hover:text-accent-foreground dark:hover:bg-zinc-800 dark:hover:text-white",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
