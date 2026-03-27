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
    { label: t("landing.nav.pricing"), href: "#pricing" },
    { label: t("landing.nav.docs"), href: "#docs" },
    { label: t("landing.nav.login"), href: "/login" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#dce7f1]/80 bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="min-w-0">
          <BrandLogo showTagline={false} priority />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-[#627890] md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-[#123d65]"
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
            className="hidden rounded-xl border-[#d7e4f1] bg-white/80 text-[#123d65] hover:bg-[#f6fbff] md:inline-flex"
          >
            <Link href="/register">{t("landing.nav.getStarted")}</Link>
          </Button>
          <Button
            asChild
            className="rounded-xl bg-[#123d65] text-white hover:bg-[#0f3252]"
          >
            <Link href="/register">{t("landing.nav.getStarted")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
