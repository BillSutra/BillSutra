"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProfileMenu from "../auth/ProfileMenu";
import ThemeToggle from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/LanguageProvider";
import { dashboardNavItems } from "./dashboard-nav";

export default function DashNavbar({
  name,
  image,
}: {
  name: string;
  image?: string;
}) {
  const pathname = usePathname();
  const { language, t } = useI18n();

  const navItems = useMemo(
    () =>
      dashboardNavItems.map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [language, t],
  );

  return (
    <nav className="border-b border-border/60 bg-background">
      <div className="grid grid-cols-1 items-center gap-4 px-6 py-4 lg:grid-cols-[auto_1fr_auto]">
        <div className="text-center text-xl font-extrabold md:text-2xl lg:text-left">
          {t("common.appName")}
        </div>
        <div className="hidden flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "transition-colors hover:text-foreground",
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "text-foreground"
                  : undefined,
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="mx-auto flex items-center gap-3 text-foreground lg:mx-0 lg:justify-self-end">
          <ThemeToggle />
          <ProfileMenu name={name} image={image} />
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2 px-6 pb-4 text-xs text-muted-foreground lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-3 py-1 transition-colors",
              pathname === item.href || pathname.startsWith(`${item.href}/`)
                ? "border-primary text-foreground"
                : "border-border hover:border-primary",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
