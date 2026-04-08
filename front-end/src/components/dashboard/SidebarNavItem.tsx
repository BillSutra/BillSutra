"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SidebarNavItemProps = {
  active: boolean;
  badge?: string;
  collapsed: boolean;
  href: string;
  highlighted?: boolean;
  icon: LucideIcon;
  label: string;
};

const SidebarNavItem = ({
  active,
  badge,
  collapsed,
  href,
  highlighted,
  icon: Icon,
  label,
}: SidebarNavItemProps) => {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? [label, badge].filter(Boolean).join(" - ") : undefined}
      className={cn(
        "group relative flex h-10 items-center rounded-xl px-3 py-2 text-sm transition-all duration-200",
        collapsed ? "justify-center" : "gap-3",
        active
          ? "border border-border/80 bg-primary/10 text-primary dark:border-white/8 dark:bg-primary/16"
          : highlighted
            ? "border border-amber-200/80 bg-amber-50/80 text-amber-800 shadow-[0_14px_28px_-24px_rgba(217,119,6,0.65)] hover:bg-amber-100/80 dark:border-amber-400/20 dark:bg-amber-400/[0.08] dark:text-amber-100 dark:hover:bg-amber-400/[0.12]"
          : "text-muted-foreground hover:bg-card/75 hover:text-foreground dark:hover:bg-white/[0.04]",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-2 left-0 w-1 rounded-r-full transition-opacity",
          active ? "bg-primary opacity-100" : "opacity-0",
        )}
      />
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-card/88 text-primary dark:bg-white/[0.06]"
            : highlighted
              ? "bg-white/70 text-amber-700 dark:bg-white/[0.06] dark:text-amber-200"
            : "bg-transparent text-muted-foreground group-hover:bg-card/88 group-hover:text-foreground dark:group-hover:bg-white/[0.04]",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      {!collapsed ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cn("truncate", active ? "font-semibold" : "font-medium")}>
            {label}
          </span>
          {badge ? (
            <Badge
              className="ml-auto shrink-0 border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/[0.12] dark:text-amber-100"
            >
              {badge}
            </Badge>
          ) : null}
        </span>
      ) : badge ? (
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-sidebar" />
      ) : null}
    </Link>
  );
};

export default SidebarNavItem;
