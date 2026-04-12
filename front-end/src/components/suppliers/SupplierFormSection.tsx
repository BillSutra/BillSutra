"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SupplierFormSectionProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
  className?: string;
};

const SupplierFormSection = ({
  icon: Icon,
  title,
  description,
  collapsible = false,
  open = true,
  onToggle,
  children,
  className,
}: SupplierFormSectionProps) => {
  return (
    <section
      className={cn(
        "rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.38)] dark:border-slate-700 dark:bg-slate-900/70",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            {description ? (
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {collapsible ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-2"
            onClick={onToggle}
            aria-expanded={open}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")}
            />
          </Button>
        ) : null}
      </div>

      {open ? <div className="mt-4 grid gap-4">{children}</div> : null}
    </section>
  );
};

export default SupplierFormSection;
