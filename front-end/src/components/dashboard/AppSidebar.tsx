"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import BrandLogo from "@/components/branding/BrandLogo";
import { dashboardNavItems, dashboardNavSections } from "./dashboard-nav";
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

  const translatedNavItems = useMemo(
    () =>
      dashboardNavItems
        .filter((item) => {
          const role = session?.user?.role;
          if (role === "WORKER") {
            return item.href === "/sales" || item.href === "/invoices";
          }

          return !item.adminOnly || role === "ADMIN";
        })
        .map((item) => ({
          ...item,
          label: t(item.labelKey),
        })),
    [session?.user?.role, t],
  );

  const groupedNavItems = useMemo(
    () =>
      dashboardNavSections
        .map((section) => ({
          ...section,
          items: translatedNavItems.filter((item) => item.section === section.id),
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

  return (
    <div className="flex h-full flex-col gap-5 p-3">
      <div
        className={cn(
          "app-panel rounded-[1.5rem] p-4",
          collapsed ? "px-2.5" : "px-3.5",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed ? "justify-center" : "justify-start",
          )}
        >
          <BrandLogo
            variant={collapsed ? "icon" : "header"}
            showTagline={false}
            className={collapsed ? "" : "gap-2.5"}
            iconClassName={collapsed ? "h-11 w-11 p-1.5" : "h-9 w-9 p-1.5"}
          />
        </div>
        {!collapsed ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Premium billing, inventory, and operations for modern teams.
          </p>
        ) : null}
      </div>

      <nav className="space-y-4">
        {groupedNavItems.map((section) => (
          <div key={section.id} className="space-y-1.5">
            {!collapsed ? (
              <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground/80">
                {section.title}
              </p>
            ) : null}
            <div className="grid gap-1">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <SidebarNavItem
                    key={item.href + item.labelKey}
                    active={active}
                    collapsed={collapsed}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                  />
                );
              })}
            </div>
          </div>
        ))}
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
  const { t } = useI18n();

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border/80 bg-sidebar/92 text-sidebar-foreground shadow-[0_18px_45px_-38px_rgba(17,37,63,0.2)] backdrop-blur-xl dark:shadow-[0_18px_48px_-36px_rgba(1,4,9,0.82)] lg:block",
          collapsed ? "w-20" : "w-60",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-end px-3 pt-3">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="rounded-2xl"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto">
            <SidebarContent collapsed={collapsed} />
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />

      <aside
        className={cn(
          "app-scrollbar fixed top-0 left-0 z-50 h-full w-72 overflow-y-auto border-r border-sidebar-border/80 bg-sidebar/96 text-sidebar-foreground shadow-[0_20px_48px_-32px_rgba(1,4,9,0.78)] transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent collapsed={false} />
      </aside>
    </>
  );
};

export default AppSidebar;
