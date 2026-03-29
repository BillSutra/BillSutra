"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarNavItemProps = {
  active: boolean;
  collapsed: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
};

const SidebarNavItem = ({
  active,
  collapsed,
  href,
  icon: Icon,
  label,
}: SidebarNavItemProps) => {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex h-10 items-center rounded-xl px-3 py-2 text-sm transition-all duration-200",
        collapsed ? "justify-center" : "gap-3",
        active
          ? "border border-border/80 bg-primary/10 text-primary dark:border-white/8 dark:bg-primary/16"
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
            : "bg-transparent text-muted-foreground group-hover:bg-card/88 group-hover:text-foreground dark:group-hover:bg-white/[0.04]",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      {!collapsed ? (
        <span className={cn("truncate", active ? "font-semibold" : "font-medium")}>
          {label}
        </span>
      ) : null}
    </Link>
  );
};

export default SidebarNavItem;
