"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import BrandLogo from "@/components/branding/BrandLogo";
import UserAvtar from "@/components/common/UserAvtar";
import {
  dashboardNavItems,
  dashboardNavSections,
  type DashboardNavSection,
} from "./dashboard-nav";
import SidebarNavItem from "./SidebarNavItem";
import { useI18n } from "@/providers/LanguageProvider";

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const SidebarContent = ({ collapsed }: { collapsed: boolean }) => {
  const pathname = usePathname();
  const { language, t } = useI18n();
  const { data: session } = useSession();
  const [collapsedSections, setCollapsedSections] = useState<
    Partial<Record<DashboardNavSection, boolean>>
  >({
    operations: false,
    salesBilling: false,
    inventory: false,
    contacts: false,
    settings: false,
  });

  const translatedNavItems = useMemo(
    () =>
      dashboardNavItems
        .filter((item) => {
          const role = session?.user?.role;
          const accountType = session?.user?.accountType;
          const isWorkerAccount =
            accountType === "WORKER" || (!accountType && role === "WORKER");

          if (isWorkerAccount) {
            return (
              item.href === "/worker-panel" ||
              item.href === "/sales" ||
              item.href === "/invoices" ||
              item.href === "/simple-bill"
            );
          }

          if (item.workerOnly) {
            return false;
          }

          return !item.adminOnly || role === "ADMIN";
        })
        .map((item) => ({
          ...item,
          badge: item.badgeKey ? t(item.badgeKey) : undefined,
          label: t(item.labelKey),
        })),
    [session?.user?.accountType, session?.user?.role, t],
  );

  const groupedNavItems = useMemo(
    () =>
      dashboardNavSections
        .map((section) => ({
          ...section,
          items: translatedNavItems.filter(
            (item) => item.section === section.id,
          ),
        }))
        .filter((section) => section.items.length > 0),
    [translatedNavItems],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const unresolvedKeys = translatedNavItems
      .filter((item) => item.label === item.labelKey)
      .map((item) => item.labelKey);

    console.debug("[AppSidebar] current language:", language);
    console.debug(
      "[AppSidebar] resolved navigation labels:",
      translatedNavItems.map(({ href, labelKey, label }) => ({
        href,
        labelKey,
        label,
      })),
    );

    if (unresolvedKeys.length > 0) {
      console.warn("[AppSidebar] unresolved navigation keys:", unresolvedKeys);
    }
  }, [language, translatedNavItems]);

  const userName = session?.user?.name || "BillSutra User";
  const userEmail = session?.user?.email || "Workspace account";
  const roleLabel =
    session?.user?.accountType === "WORKER" || session?.user?.role === "WORKER"
      ? "Worker"
      : session?.user?.role === "ADMIN"
        ? "Admin"
        : "Owner";

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div
        className={cn(
          "rounded-2xl border border-transparent p-2.5",
          collapsed ? "px-2" : "px-3",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl px-1 py-1",
            collapsed ? "justify-center" : "justify-start",
          )}
        >
          <BrandLogo
            variant={collapsed ? "icon" : "header"}
            showTagline={false}
            className={collapsed ? "" : "gap-2.5"}
            iconClassName={collapsed ? "h-11 w-11 p-1.5" : "h-10 w-10 p-1.5"}
          />
        </div>
        {!collapsed ? (
          <p className="ml-[3.35rem] mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-zinc-400">
            Smart Billing OS
          </p>
        ) : null}
      </div>

      <nav className="app-scrollbar mt-3 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {groupedNavItems.map((section) => {
          const hasActiveItem = section.items.some(
            (item) =>
              pathname === item.href || pathname.startsWith(`${item.href}/`),
          );
          const canCollapseSection = section.id !== "main" && !collapsed;
          const sectionCollapsed =
            canCollapseSection &&
            collapsedSections[section.id] &&
            !hasActiveItem;
          const isExpanded =
            collapsed || section.id === "main" || !sectionCollapsed;

          return (
            <div key={section.id} className="space-y-2">
              {!collapsed ? (
                canCollapseSection ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400 transition-all duration-200 hover:bg-white/80 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setCollapsedSections((current) => ({
                        ...current,
                        [section.id]: !current[section.id],
                      }))
                    }
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform",
                        isExpanded && "rotate-90",
                      )}
                    />
                    <span className="truncate">{section.title}</span>
                  </button>
                ) : (
                  <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500">
                    {section.title}
                  </p>
                )
              ) : null}
              {isExpanded ? (
                <div className="grid gap-1.5">
                  {section.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                    return (
                      <SidebarNavItem
                        key={item.href + item.labelKey}
                        active={active}
                        badge={item.badge}
                        collapsed={collapsed}
                        highlighted={item.highlighted}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div
        className={cn(
          "mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.16)] dark:border-zinc-800 dark:bg-zinc-900",
          collapsed && "flex justify-center p-2",
        )}
      >
        {collapsed ? (
          <Link
            href="/settings"
            title="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <UserAvtar name={userName} image={session?.user?.image ?? undefined} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                {userName}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
                {userEmail}
              </p>
              <span className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                {roleLabel}
              </span>
            </div>
            <Link
              href="/settings"
              title="Settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

const AppSidebar = ({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) => {
  const { t } = useI18n();

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-slate-50/96 text-sidebar-foreground shadow-[0_18px_40px_-34px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/96 dark:shadow-[0_18px_45px_-38px_rgba(1,4,9,0.82)] lg:block",
          collapsed ? "w-20" : "w-[270px]",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-end px-4 pt-4">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="rounded-xl border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              onClick={onToggleCollapsed}
              aria-label={
                collapsed ? t("sidebar.expand") : t("sidebar.collapse")
              }
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="min-h-0 flex-1">
            <SidebarContent collapsed={collapsed} />
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm transition-opacity dark:bg-zinc-950/70 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[290px] border-r border-slate-200 bg-slate-50 text-sidebar-foreground shadow-[0_20px_44px_-32px_rgba(15,23,42,0.16)] transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_20px_48px_-32px_rgba(1,4,9,0.78)] lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent collapsed={false} />
      </aside>
    </>
  );
};

export default AppSidebar;
