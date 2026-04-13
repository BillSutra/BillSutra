"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CircleHelp, Menu, Search } from "lucide-react";
import { toast } from "sonner";
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
  onOpenHelp: () => void;
};

const TopNavbar = ({
  name,
  image,
  onOpenMobileMenu,
  onOpenHelp,
}: TopNavbarProps) => {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const quickLinks = useMemo(
    () => [
      {
        href: "/dashboard",
        label: "dashboard",
        keywords: ["dashboard", "home", "overview"],
      },
      {
        href: "/simple-bill",
        label: "simple bill",
        keywords: ["simple bill", "create bill", "new bill", "create invoice"],
      },
      {
        href: "/invoices",
        label: "invoices",
        keywords: ["bill", "bills", "invoice", "invoices"],
      },
      {
        href: "/products",
        label: "products",
        keywords: ["product", "products", "item", "items", "stock"],
      },
      {
        href: "/customers",
        label: "customers",
        keywords: ["customer", "customers", "client", "clients"],
      },
      {
        href: "/invoices/history",
        label: "past bills",
        keywords: ["history", "records", "bill history", "invoice history", "past bills"],
      },
      {
        href: "/insights",
        label: "reports",
        keywords: ["reports", "insights", "analytics"],
      },
      {
        href: "/business-profile",
        label: "shop details",
        keywords: ["shop", "business", "profile", "settings"],
      },
    ],
    [],
  );

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = query.trim().toLowerCase();
    if (!normalized) return;

    const match = quickLinks.find(
      (item) =>
        item.label.includes(normalized) ||
        item.keywords.some(
          (keyword) =>
            keyword.includes(normalized) || normalized.includes(keyword),
        ),
    );

    if (!match) {
      toast.error("Try simple bill, products, customers, reports, or shop details.");
      return;
    }

    router.push(match.href);
    setQuery("");
  };

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

            <form
              className="relative hidden w-full max-w-[32rem] md:block"
              onSubmit={handleSearchSubmit}
            >
              <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("topNavbar.searchPlaceholder")}
                className="h-11 rounded-full pl-11 pr-4 placeholder:text-muted-foreground"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-2xl"
              aria-label="Help"
              onClick={onOpenHelp}
            >
              <CircleHelp className="h-4 w-4" />
            </Button>
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

        <form className="relative mt-3 md:hidden" onSubmit={handleSearchSubmit}>
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("topNavbar.searchPlaceholder")}
            className="h-11 rounded-full pl-11 pr-4 placeholder:text-muted-foreground"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
      </div>
    </header>
  );
};

export default TopNavbar;
