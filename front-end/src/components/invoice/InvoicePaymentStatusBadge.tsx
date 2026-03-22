"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type InvoicePaymentStatusBadgeProps = {
  label: string;
  variant: "paid" | "pending" | "overdue";
  hint?: string;
  className?: string;
};

const InvoicePaymentStatusBadge = ({
  label,
  variant,
  hint,
  className,
}: InvoicePaymentStatusBadgeProps) => {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Badge variant={variant} className="px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
        {label}
      </Badge>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
};

export default InvoicePaymentStatusBadge;
