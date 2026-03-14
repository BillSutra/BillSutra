"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dashboardNavItems } from "./dashboard-nav";
import { useBusinessLogo } from "@/hooks/useBusinessLogo";

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const SidebarContent = ({ collapsed }: { collapsed: boolean }) => {
  const pathname = usePathname();
  const { logo } = useBusinessLogo();

  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <div className="flex h-11 items-center rounded-xl bg-indigo-600 px-3 text-white shadow-md">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/20 text-xs font-bold overflow-hidden">
          {/* Show uploaded business logo, or fallback to "BS" text */}
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Business logo" className="h-6 w-6 object-contain" />
          ) : (
            "BS"
          )}
        </div>
        {!collapsed && (
          <span className="ml-3 text-sm font-semibold">BillSutra</span>
        )}
      </div>

      <nav className="grid gap-1">
        {dashboardNavItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                "hover:-translate-y-px hover:bg-gray-100 dark:hover:bg-gray-800",
                active
                  ? "bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-200"
                  : "text-gray-600 dark:text-gray-300",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

const AppSidebar = ({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) => {
  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-gray-200/70 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 lg:block",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-end px-3 pt-3">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarContent collapsed={collapsed} />
          </div>

          <div className="flex items-center justify-end px-3 pb-3">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-72 overflow-y-auto border-r border-gray-200 bg-white transition-transform duration-200 dark:border-gray-800 dark:bg-gray-900 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent collapsed={false} />
      </aside>
    </>
  );
};

export default AppSidebar;
