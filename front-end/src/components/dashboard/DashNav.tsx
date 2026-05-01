"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import ProfileMenu from "../auth/ProfileMenu";
import ThemeToggle from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/LanguageProvider";
import { dashboardNavItems } from "./dashboard-nav";
import BrandLogo from "@/components/branding/BrandLogo";

export default function DashNavbar({
  name,
  image,
}: {
  name: string;
  image?: string;
}) {
  const pathname = usePathname();
  const { language, t } = useI18n();
  const { data: session } = useSession();

  const navItems = useMemo(
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

          return !item.adminOnly || role === "ADMIN";
        })
        .map((item) => ({
          ...item,
          label: t(item.labelKey),
        })),
    [language, session?.user?.accountType, session?.user?.role, t],
  );

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md transition-all duration-200">
      <div className="grid grid-cols-1 items-center gap-4 px-6 py-4 lg:grid-cols-[auto_1fr_auto]">
        <div className="flex justify-center lg:justify-start">
          <BrandLogo
            showTagline={false}
            className="gap-2.5"
            iconClassName="h-10 w-10 rounded-[1.15rem] p-1.5 shadow-[0_12px_24px_-18px_rgba(255,255,255,0.1)]"
          />
        </div>
        <div className="hidden flex-wrap items-center justify-center gap-4 text-sm text-zinc-400 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "transition-colors duration-200 hover:text-white",
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "text-white"
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
      <div className="flex flex-wrap justify-center gap-2 px-6 pb-4 text-xs text-zinc-400 lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-3 py-1 transition-all duration-200",
              pathname === item.href || pathname.startsWith(`${item.href}/`)
                ? "border-blue-500 bg-blue-600/15 text-white"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
