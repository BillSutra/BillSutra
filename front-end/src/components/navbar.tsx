"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import LanguageToggle from "@/components/language-toggle";
import { useI18n } from "@/providers/LanguageProvider";
import BrandLogo from "@/components/branding/BrandLogo";

const Navbar = () => {
  const { t } = useI18n();

  const navItems = [
    { label: t("landing.nav.features"), href: "#features" },
    { label: t("landing.nav.preview"), href: "#product" },
    { label: t("landing.nav.customers"), href: "#testimonials" },
    { label: t("landing.nav.pricing"), href: "/pricing" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/88 backdrop-blur-md transition-all duration-200 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-[0_14px_32px_-28px_rgba(0,0,0,0.82)]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="min-w-0">
          <BrandLogo showTagline={false} priority />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-slate-500 md:flex dark:text-zinc-400">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-all duration-200 hover:text-slate-950 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageToggle className="hidden sm:inline-flex" />
          <ThemeToggle />
          <Button
            asChild
            variant="outline"
            className="hidden rounded-xl border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 md:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <Link href="/login">{t("landing.nav.login")}</Link>
          </Button>
          <Button
            asChild
            className="rounded-xl bg-blue-600 text-white hover:bg-blue-500"
          >
            <Link href="/register">{t("landing.nav.getStarted")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
