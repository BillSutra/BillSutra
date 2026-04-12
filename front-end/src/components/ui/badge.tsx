import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-muted-foreground",
        paid: "border-emerald-300/70 bg-emerald-100/70 text-emerald-900 dark:border-emerald-400/28 dark:bg-emerald-500/12 dark:text-emerald-200",
        pending:
          "border-amber-300/70 bg-amber-100/70 text-amber-900 dark:border-amber-400/28 dark:bg-amber-500/12 dark:text-amber-200",
        overdue:
          "border-rose-300/70 bg-rose-100/70 text-rose-900 dark:border-rose-400/28 dark:bg-rose-500/12 dark:text-rose-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
