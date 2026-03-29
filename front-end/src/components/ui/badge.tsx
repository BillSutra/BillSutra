import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-gray-200 bg-gray-100 text-gray-700 dark:border-white/8 dark:bg-white/[0.04] dark:text-gray-200",
        paid: "border-green-200 bg-green-50 text-green-700 dark:border-green-400/12 dark:bg-green-400/[0.08] dark:text-green-200",
        pending:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/12 dark:bg-amber-400/[0.08] dark:text-amber-200",
        overdue:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-400/12 dark:bg-red-400/[0.08] dark:text-red-200",
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
