"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { Hexagon } from "lucide-react";
import LanguageToggle from "@/components/language-toggle";
import { useI18n } from "@/providers/LanguageProvider";

const Navbar = () => {
  const { t } = useI18n();

  const navItems = [
    { label: t("landing.nav.features"), href: "#features" },
    { label: t("landing.nav.pricing"), href: "#pricing" },
    { label: t("landing.nav.docs"), href: "#docs" },
    { label: t("landing.nav.login"), href: "/login" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Hexagon size={18} />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            BillSutra
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageToggle className="hidden sm:inline-flex" />
          <ThemeToggle />
          <Button asChild className="hidden md:inline-flex">
            <Link href="/register">{t("landing.nav.getStarted")}</Link>
          </Button>
          <Button
            asChild
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/register">{t("landing.nav.getStarted")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
