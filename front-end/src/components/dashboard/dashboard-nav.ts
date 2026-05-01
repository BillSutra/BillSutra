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
  | "salesBilling"
  | "productsInventory"
  | "contacts"
  | "purchases"
  | "customization"
  | "system";

type DashboardNavItem = {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  section: DashboardNavSection;
  adminOnly?: boolean;
  badgeKey?: string;
  highlighted?: boolean;
};

export const dashboardNavSections: Array<{
  id: DashboardNavSection;
  title: string;
}> = [
  { id: "main", title: "Main" },
  { id: "salesBilling", title: "Sales & Billing" },
  { id: "productsInventory", title: "Products & Inventory" },
  { id: "contacts", title: "Contacts" },
  { id: "purchases", title: "Purchases" },
  { id: "customization", title: "Customization" },
  { id: "system", title: "System" },
];

export const dashboardNavItems: DashboardNavItem[] = [
  {
    labelKey: "navigation.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    section: "main",
  },
  {
    labelKey: "navigation.workers",
    href: "/worker-panel",
    icon: UserCog,
    section: "main",
  },
  {
    labelKey: "navigation.simpleBill",
    href: "/simple-bill",
    icon: Zap,
    section: "main",
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
    section: "productsInventory",
  },
  {
    labelKey: "navigation.inventory",
    href: "/inventory",
    icon: Boxes,
    section: "productsInventory",
  },
  {
    labelKey: "navigation.warehouses",
    href: "/warehouses",
    icon: Warehouse,
    section: "productsInventory",
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
    section: "system",
    adminOnly: true,
  },
  {
    labelKey: "navigation.purchases",
    href: "/purchases",
    icon: ShoppingCart,
    section: "purchases",
  },
  {
    labelKey: "navigation.templates",
    href: "/templates",
    icon: Shapes,
    section: "customization",
  },
  {
    labelKey: "navigation.businessProfile",
    href: "/business-profile",
    icon: Building2,
    section: "customization",
  },
  {
    labelKey: "landing.nav.pricing",
    href: "/pricing",
    icon: CircleDollarSign,
    section: "system",
  },
  {
    labelKey: "navigation.settings",
    href: "/settings",
    icon: Settings,
    section: "system",
  },
];
