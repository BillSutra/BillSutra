import {
  BarChart3,
  Bot,
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
    labelKey: "navigation.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    labelKey: "navigation.insights",
    href: "/insights",
    icon: BarChart3,
  },
  {
    labelKey: "navigation.assistant",
    href: "/assistant",
    icon: Bot,
  },
  {
    labelKey: "navigation.products",
    href: "/products",
    icon: Package,
  },
  {
    labelKey: "navigation.inventory",
    href: "/inventory",
    icon: Boxes,
  },
  {
    labelKey: "navigation.warehouses",
    href: "/warehouses",
    icon: Warehouse,
  },
  {
    labelKey: "navigation.invoices",
    href: "/invoices",
    icon: FileText,
  },
  {
    labelKey: "navigation.invoiceRecords",
    href: "/invoices/history",
    icon: FileText,
  },
  {
    labelKey: "navigation.clients",
    href: "/customers",
    icon: Users,
  },
  {
    labelKey: "navigation.suppliers",
    href: "/suppliers",
    icon: Store,
  },
  {
    labelKey: "navigation.purchases",
    href: "/purchases",
    icon: ShoppingCart,
  },
  {
    labelKey: "navigation.sales",
    href: "/sales",
    icon: ShoppingBag,
  },
  {
    labelKey: "navigation.templates",
    href: "/templates",
    icon: Shapes,
  },
  {
    labelKey: "navigation.businessProfile",
    href: "/business-profile",
    icon: Building2,
  },
  {
    labelKey: "navigation.settings",
    href: "/settings",
    icon: Settings,
  },
] as const;
