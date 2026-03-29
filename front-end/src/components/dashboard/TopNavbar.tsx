"use client";

import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThemeToggle from "@/components/theme-toggle";
import LanguageToggle from "@/components/language-toggle";
import ProfileMenu from "@/components/auth/ProfileMenu";
import { useI18n } from "@/providers/LanguageProvider";
import BrandLogo from "@/components/branding/BrandLogo";

type TopNavbarProps = {
  name: string;
  image?: string;
  onOpenMobileMenu: () => void;
};

const TopNavbar = ({ name, image, onOpenMobileMenu }: TopNavbarProps) => {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/78 shadow-[0_1px_0_rgba(17,37,63,0.05)] backdrop-blur-xl dark:bg-background/72 dark:shadow-[0_12px_30px_-26px_rgba(1,4,9,0.9)]">
      <div className="px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-h-[3.75rem] items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="rounded-2xl lg:hidden"
              aria-label={t("topNavbar.openSidebar")}
              onClick={onOpenMobileMenu}
            >
              <Menu className="h-4 w-4" />
            </Button>

            <Link href="/dashboard" className="shrink-0">
              <BrandLogo
                showTagline={false}
                className="gap-2.5"
                iconClassName="h-10 w-10 rounded-[1.15rem] p-1.5 sm:h-11 sm:w-11"
              />
            </Link>

            <div className="relative hidden w-full max-w-[32rem] md:block">
              <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("topNavbar.searchPlaceholder")}
                className="h-11 rounded-full pl-11 pr-4 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-2xl"
              aria-label={t("topNavbar.notifications")}
            >
              <Bell className="h-4 w-4" />
            </Button>
            <LanguageToggle className="hidden sm:inline-flex" />
            <ThemeToggle />
            <ProfileMenu name={name} image={image} />
          </div>
        </div>

        <div className="relative mt-3 md:hidden">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("topNavbar.searchPlaceholder")}
            className="h-11 rounded-full pl-11 pr-4 placeholder:text-muted-foreground"
          />
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
