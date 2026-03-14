import {
  Boxes,
  Building2,
  FileText,
  LayoutDashboard,
  Package,
  ShoppingBag,
  ShoppingCart,
  Settings,
  Shapes,
  Store,
  Users,
  Warehouse,
} from "lucide-react";

export const dashboardNavItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Products",
    href: "/products",
    icon: Package,
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Boxes,
  },
  {
    label: "Warehouses",
    href: "/warehouses",
    icon: Warehouse,
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: FileText,
  },
  {
    label: "Clients",
    href: "/customers",
    icon: Users,
  },
  {
    label: "Suppliers",
    href: "/suppliers",
    icon: Store,
  },
  {
    label: "Purchases",
    href: "/purchases",
    icon: ShoppingCart,
  },
  {
    label: "Sales",
    href: "/sales",
    icon: ShoppingBag,
  },
  {
    label: "Templates",
    href: "/templates",
    icon: Shapes,
  },
  {
    label: "Business Profile",
    href: "/business-profile",
    icon: Building2,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
] as const;
