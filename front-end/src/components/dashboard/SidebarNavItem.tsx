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
        "group relative flex h-10 items-center rounded-xl border border-transparent px-3 py-2 text-sm transition-all duration-200",
        collapsed ? "justify-center" : "gap-3",
        active
          ? "border-blue-200 bg-blue-50 text-blue-700 shadow-[0_12px_24px_-20px_rgba(37,99,235,0.28)] ring-1 ring-blue-100 dark:border-blue-500/60 dark:bg-blue-600/20 dark:text-blue-400 dark:shadow-[0_10px_24px_-18px_rgba(37,99,235,0.55)] dark:ring-blue-500/20"
          : highlighted
            ? "border border-amber-200 bg-amber-50 text-amber-800 shadow-[0_14px_28px_-24px_rgba(217,119,6,0.18)] hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/[0.08] dark:text-amber-100 dark:shadow-[0_14px_28px_-24px_rgba(217,119,6,0.4)] dark:hover:bg-amber-400/[0.12]"
          : "text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-2 left-0 w-1 rounded-r-full transition-opacity",
          active ? "bg-blue-500 opacity-100" : "opacity-0",
        )}
      />
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/12 dark:text-blue-400"
            : highlighted
              ? "bg-white text-amber-700 dark:bg-white/[0.06] dark:text-amber-200"
            : "bg-transparent text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-900 dark:text-zinc-500 dark:group-hover:bg-zinc-700/80 dark:group-hover:text-white",
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
