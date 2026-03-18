"use client";

import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThemeToggle from "@/components/theme-toggle";
import ProfileMenu from "@/components/auth/ProfileMenu";

type TopNavbarProps = {
  name: string;
  image?: string;
  onOpenMobileMenu: () => void;
};

const TopNavbar = ({ name, image, onOpenMobileMenu }: TopNavbarProps) => {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="lg:hidden"
          aria-label="Open sidebar"
          onClick={onOpenMobileMenu}
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="relative hidden w-full max-w-md sm:block">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoices, customers, products..."
            className="h-10 rounded-xl border-border bg-card pl-9 shadow-sm"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <ProfileMenu name={name} image={image} />
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
