"use client";

import Link from "next/link";
import ProfileMenu from "../auth/ProfileMenu";
import ThemeToggle from "@/components/theme-toggle";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Products", href: "/products" },
  { label: "Inventory", href: "/inventory" },
  { label: "Warehouses", href: "/warehouses" },
  { label: "Invoices", href: "/invoices" },
  { label: "Invoice Records", href: "/invoices/history" },
  { label: "Clients", href: "/customers" },
  { label: "Suppliers", href: "/suppliers" },
  { label: "Purchases", href: "/purchases" },
  { label: "Sales", href: "/sales" },
  { label: "Templates", href: "/templates" },
  { label: "Business Profile", href: "/business-profile" },
  { label: "Settings", href: "/settings" },
];

export default function DashNavbar({
  name,
  image,
}: {
  name: string;
  image?: string;
}) {
  return (
    <nav className="border-b border-border/60 bg-background">
      <div className="grid grid-cols-1 items-center gap-4 px-6 py-4 lg:grid-cols-[auto_1fr_auto]">
        <div className="text-center text-xl font-extrabold md:text-2xl lg:text-left">
          BillSutra
        </div>
        <div className="hidden flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-foreground"
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
            className="rounded-full border border-border px-3 py-1 hover:border-primary"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
