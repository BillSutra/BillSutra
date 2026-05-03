import {
  BarChart3,
  Bot,
  Boxes,
  Building2,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  Package,
  ShoppingBag,
  ShoppingCart,
  Settings,
  Shapes,
  Store,
  UserCog,
  Users,
  Warehouse,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavSection =
  | "main"
  | "operations"
  | "salesBilling"
  | "inventory"
  | "contacts"
  | "settings";

type DashboardNavItem = {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  section: DashboardNavSection;
  adminOnly?: boolean;
  workerOnly?: boolean;
  badgeKey?: string;
  highlighted?: boolean;
};

export const dashboardNavSections: Array<{
  id: DashboardNavSection;
  title: string;
}> = [
  { id: "main", title: "Dashboard" },
  { id: "operations", title: "Operations" },
  { id: "salesBilling", title: "Sales & Billing" },
  { id: "inventory", title: "Inventory" },
  { id: "contacts", title: "Contacts" },
  { id: "settings", title: "Settings" },
];

export const dashboardNavItems: DashboardNavItem[] = [
  {
    labelKey: "navigation.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    section: "main",
  },
  {
    labelKey: "navigation.workerPanel",
    href: "/worker-panel",
    icon: UserCog,
    section: "operations",
    workerOnly: true,
  },
  {
    labelKey: "navigation.simpleBill",
    href: "/simple-bill",
    icon: Zap,
    section: "operations",
    badgeKey: "navigation.simpleBillBadge",
    highlighted: true,
  },
  {
    labelKey: "navigation.insights",
    href: "/insights",
    icon: BarChart3,
    section: "main",
  },
  {
    labelKey: "navigation.assistant",
    href: "/assistant",
    icon: Bot,
    section: "main",
  },
  {
    labelKey: "navigation.invoices",
    href: "/invoices",
    icon: FileText,
    section: "salesBilling",
  },
  {
    labelKey: "navigation.invoiceRecords",
    href: "/invoices/history",
    icon: FileText,
    section: "salesBilling",
  },
  {
    labelKey: "navigation.sales",
    href: "/sales",
    icon: ShoppingBag,
    section: "salesBilling",
  },
  {
    labelKey: "navigation.products",
    href: "/products",
    icon: Package,
    section: "inventory",
  },
  {
    labelKey: "navigation.inventory",
    href: "/inventory",
    icon: Boxes,
    section: "inventory",
  },
  {
    labelKey: "navigation.warehouses",
    href: "/warehouses",
    icon: Warehouse,
    section: "inventory",
  },
  {
    labelKey: "navigation.clients",
    href: "/customers",
    icon: Users,
    section: "contacts",
  },
  {
    labelKey: "navigation.suppliers",
    href: "/suppliers",
    icon: Store,
    section: "contacts",
  },
  {
    labelKey: "navigation.workers",
    href: "/workers",
    icon: UserCog,
    section: "settings",
    adminOnly: true,
  },
  {
    labelKey: "navigation.purchases",
    href: "/purchases",
    icon: ShoppingCart,
    section: "operations",
  },
  {
    labelKey: "navigation.templates",
    href: "/templates",
    icon: Shapes,
    section: "settings",
  },
  {
    labelKey: "navigation.businessProfile",
    href: "/business-profile",
    icon: Building2,
    section: "settings",
  },
  {
    labelKey: "landing.nav.pricing",
    href: "/pricing",
    icon: CircleDollarSign,
    section: "settings",
  },
  {
    labelKey: "navigation.settings",
    href: "/settings",
    icon: Settings,
    section: "settings",
  },
];
