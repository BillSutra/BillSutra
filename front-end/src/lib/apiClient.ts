import axios from "axios";
import { getSession } from "next-auth/react";
import { API_URL } from "./apiEndPoints";
import { normalizeListResponse } from "./normalizeListResponse";

const normalizeAuthToken = (rawToken: string | null | undefined) => {
  if (!rawToken) return null;
  const token = rawToken.trim();
  if (!token) return null;
  if (token === "undefined" || token === "null") return null;
  if (token === "Bearer undefined" || token === "Bearer null") return null;
  return token;
};

export const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    let token = normalizeAuthToken(window.localStorage.getItem("token"));

    if (!token) {
      const session = await getSession();
      token = normalizeAuthToken(
        (session?.user as { token?: string } | undefined)?.token ?? null,
      );
      if (token) {
        window.localStorage.setItem("token", token);
      } else {
        window.localStorage.removeItem("token");
      }
    }

    if (token) {
      const header = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
      config.headers.Authorization = header;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
  }
  return config;
});

export type ReportsSummary = {
  invoices: number;
  total_billed: number;
  total_paid: number;
  sales: number;
  total_sales: number;
  purchases: number;
  total_purchases: number;
  profit: number;
  overdue: number;
  low_stock: Array<{
    id: number;
    name: string;
    sku: string;
    stock_on_hand: number;
    reorder_level: number;
  }>;
};

export type Product = {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  price: string;
  cost?: string | null;
  gst_rate: string;
  stock_on_hand: number;
  reorder_level: number;
  category?: { id: number; name: string } | null;
};

export type Category = {
  id: number;
  name: string;
};

export type ProductInput = {
  name: string;
  sku: string;
  price: number;
  cost?: number | null;
  barcode?: string | null;
  gst_rate?: number | null;
  stock_on_hand?: number | null;
  reorder_level?: number | null;
  category_id?: number | null;
};

export type Customer = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type CustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type Supplier = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type SupplierInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type Purchase = {
  id: number;
  purchase_date: string;
  subtotal: string;
  tax: string;
  total: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  paymentDate?: string | null;
  paymentMethod?:
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "UPI"
  | "CHEQUE"
  | "OTHER"
  | null;
  notes?: string | null;
  supplier?: Supplier | null;
  warehouse?: { id: number; name: string } | null;
  items: Array<{
    id: number;
    product_id?: number | null;
    name: string;
    quantity: number;
    unit_cost: string;
    tax_rate?: string | null;
    line_total: string;
  }>;
};

export type PurchaseInput = {
  supplier_id?: number | null;
  warehouse_id?: number | null;
  purchase_date?: string | Date | null;
  payment_status?: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  amount_paid?: number | null;
  payment_date?: string | Date | null;
  payment_method?:
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "UPI"
  | "CHEQUE"
  | "OTHER"
  | null;
  notes?: string | null;
  items: Array<{
    product_id: number;
    quantity: number;
    unit_cost: number;
    tax_rate?: number | null;
  }>;
};

export type Sale = {
  id: number;
  sale_date: string;
  status: string;
  subtotal: string;
  tax: string;
  total: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  paymentDate?: string | null;
  paymentMethod?:
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "UPI"
  | "CHEQUE"
  | "OTHER"
  | null;
  notes?: string | null;
  customer?: Customer | null;
  items: Array<{
    id: number;
    product_id?: number | null;
    name: string;
    quantity: number;
    unit_price: string;
    tax_rate?: string | null;
    line_total: string;
  }>;
};

export type SaleInput = {
  customer_id?: number | null;
  warehouse_id?: number | null;
  sale_date?: string | Date | null;
  status?: string | null;
  payment_status?: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  amount_paid?: number | null;
  payment_date?: string | Date | null;
  payment_method?:
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "UPI"
  | "CHEQUE"
  | "OTHER"
  | null;
  notes?: string | null;
  items: Array<{
    product_id: number;
    quantity: number;
    unit_price: number;
    tax_rate?: number | null;
  }>;
};

export type Invoice = {
  id: number;
  invoice_number: string;
  date: string;
  due_date?: string | null;
  status: string;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  customer?: Customer | null;
  payments: Array<{
    id: number;
    amount: string;
    method?:
      | "CASH"
      | "CARD"
      | "BANK_TRANSFER"
      | "UPI"
      | "CHEQUE"
      | "OTHER"
      | null;
    paid_at?: string | null;
  }>;
  items: Array<{
    id: number;
    product_id?: number | null;
    name: string;
    quantity: number;
    price: string;
    tax_rate?: string | null;
    total: string;
  }>;
};

export type InvoiceInput = {
  customer_id: number;
  date?: string | Date | null;
  due_date?: string | Date | null;
  discount?: number | null;
  status?: string | null;
  notes?: string | null;
  sync_sales?: boolean;
  warehouse_id?: number | null;
  items: Array<{
    product_id?: number | null;
    name: string;
    quantity: number;
    price: number;
    tax_rate?: number | null;
  }>;
};

export type Warehouse = {
  id: number;
  name: string;
  location?: string | null;
  inventories?: Array<{
    id: number;
    quantity: number;
    product: Product;
  }>;
};

export type WarehouseInput = {
  name: string;
  location?: string | null;
};

export type Inventory = {
  id: number;
  quantity: number;
  warehouse_id?: number;
  product_id?: number;
  warehouse: Warehouse;
  product: Product;
};

export type InventoryAdjustInput = {
  warehouse_id: number;
  product_id: number;
  change: number;
  reason?: "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN" | "DAMAGE";
  note?: string | null;
};

export type DashboardOverview = {
  filters?: {
    range: string;
    label: string;
    granularity: string;
    startDate: string;
    endDate: string;
  };
  metrics: {
    totalRevenue: number;
    totalSales: number;
    totalPurchases: number;
    expenses: number;
    receivables: number;
    payables: number;
    pendingPayments: number;
    inventoryValue: number;
    profits: {
      today: number;
      weekly: number;
      monthly: number;
      yearly: number;
    };
    changes: {
      totalRevenue: number;
      totalSales: number;
      totalPurchases: number;
      expenses: number;
      receivables: number;
      payables: number;
      todayProfit: number;
      weeklyProfit: number;
      monthlyProfit: number;
      yearlyProfit: number;
      pendingPayments: number;
      inventoryValue: number;
    };
  };
  invoiceStats: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
  };
  paymentMethods: {
    sales: Array<{
      method: "CASH" | "CARD" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "OTHER";
      count: number;
      amount: number;
    }>;
    purchases: Array<{
      method: "CASH" | "CARD" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "OTHER";
      count: number;
      amount: number;
    }>;
  };
  alerts: {
    lowStock: string[];
    overdueInvoices: string[];
    supplierPayables: string[];
  };
  notifications: Array<{
    id: string;
    type: "LOW_STOCK" | "PENDING_INVOICE" | "SUPPLIER_PAYABLE";
    title: string;
    message: string;
    redirectUrl: string;
    createdAt: string;
    read: boolean;
  }>;
  pendingPayments?: Array<{
    id: number;
    invoiceNumber: string;
    customer: string;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    paymentStatus: "PAID" | "PARTIAL" | "PENDING";
    date: string;
  }>;
  activity: Array<{ time: string; label: string }>;
};

export type DashboardCardMetrics = {
  filters?: {
    range: string;
    label: string;
    granularity: string;
    startDate: string;
    endDate: string;
  };
  metrics: {
    totalSales: number;
    totalPurchases: number;
    pendingSalesPayments: number;
    pendingPurchasePayments: number;
    profits: {
      today: number;
      weekly: number;
      monthly: number;
      yearly: number;
    };
    changes: {
      totalSales: number;
      totalPurchases: number;
      pendingSalesPayments: number;
      pendingPurchasePayments: number;
      todayProfit: number;
      weeklyProfit: number;
      monthlyProfit: number;
      yearlyProfit: number;
    };
  };
};

export type DashboardOverviewFilters = {
  range?: "7d" | "30d" | "90d" | "ytd" | "custom";
  startDate?: string;
  endDate?: string;
  granularity?: "day" | "week" | "month";
};

const buildDashboardFilterParams = (filters?: DashboardOverviewFilters) => {
  if (!filters) return undefined;
  const params: Record<string, string> = {};
  if (filters.range) params.range = filters.range;
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;
  if (filters.granularity) params.granularity = filters.granularity;
  return params;
};

export type PaymentInput = {
  invoice_id: number;
  amount: number;
  method?: "CASH" | "CARD" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "OTHER";
  provider?: string;
  transaction_id?: string;
  reference?: string;
  paid_at?: string | Date;
};

export type DashboardSales = {
  last7Days: Array<{ date: string; sales: number; purchases: number }>;
  last30Days: Array<{ date: string; sales: number; purchases: number }>;
  monthly: Array<{ month: string; sales: number; purchases: number }>;
  categories: Array<{ name: string; value: number }>;
};

export type DashboardInventory = {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  inventoryValue: number;
  topSelling: { name: string; units: number } | null;
  lowStockItems: Array<{
    name: string;
    stock: number;
    reorder: number;
  }>;
};

export type DashboardTransaction = {
  date: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  paymentStatus: "PAID" | "PARTIAL" | "PENDING";
};

export type DashboardTransactions = {
  transactions: DashboardTransaction[];
};

export type DashboardCustomers = {
  totalRegisteredCustomers: number;
  pendingPayments: number;
  customerVisits: {
    daily: {
      registeredCustomers: number;
      walkInCustomers: number;
      totalCustomers: number;
    };
    weekly: {
      registeredCustomers: number;
      walkInCustomers: number;
      totalCustomers: number;
    };
    monthly: {
      registeredCustomers: number;
      walkInCustomers: number;
      totalCustomers: number;
    };
  };
  topCustomers: Array<{
    name: string;
    totalPurchaseAmount: number;
    numberOfOrders: number;
  }>;
  clvAnalytics: {
    premiumCustomers: Array<{
      customerId: number | null;
      customerName: string;
      lifetimeValue: number;
      predicatedFutureValue: number;
      totalOrders: number;
      compositeScore: number;
      segment: "PREMIUM" | "REGULAR" | "NEW_LOW";
    }>;
    regularCustomers: Array<{
      customerId: number | null;
      customerName: string;
      lifetimeValue: number;
      predicatedFutureValue: number;
      totalOrders: number;
      compositeScore: number;
      segment: "PREMIUM" | "REGULAR" | "NEW_LOW";
    }>;
    newLowCustomers: Array<{
      customerId: number | null;
      customerName: string;
      lifetimeValue: number;
      predicatedFutureValue: number;
      totalOrders: number;
      compositeScore: number;
      segment: "PREMIUM" | "REGULAR" | "NEW_LOW";
    }>;
    premiumCount: number;
    regularCount: number;
    newLowCount: number;
  };
  churnAnalytics?: {
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    topAtRiskCustomers: Array<{
      customerId: number;
      customerName: string;
      lastPurchaseDate: string;
      daysSinceLastPurchase: number;
      churnProbability: number;
      riskLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
    }>;
  };
};

export type DashboardSuppliers = {
  total: number;
  recentPurchases: number;
  outstandingPayables: number;
  supplierAnalytics?: {
    highValueCount: number;
    lowValueCount: number;
    highValueSuppliers: Array<{
      supplierName: string;
      lifetimeValue: number;
      predictedFutureValue: number;
    }>;
    lowValueSuppliers: Array<{
      supplierName: string;
      lifetimeValue: number;
      predictedFutureValue: number;
    }>;
  };
  topSuppliers?: Array<{
    name: string;
    totalPurchaseAmount: number;
    numberOfOrders: number;
  }>;
};

export type DashboardCashflow = {
  inflowSourceMode?: "sales" | "payments" | "hybrid";
  inflow: number;
  outflow: number;
  netCashFlow: number;
  series: Array<{ date: string; inflow: number; outflow: number }>;
};

export type DashboardProfit = {
  monthly: Array<{
    month: string;
    revenue: number;
    totalCost: number;
    expenses: number;
    profit: number;
    margin: number;
  }>;
  last30: Array<{
    date: string;
    revenue: number;
    cost: number;
    expenses: number;
    profit: number;
  }>;
};

export type DashboardProductSales = {
  period: "lifetime" | "month" | "week" | "year";
  products: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
};

export type DashboardPaymentMethods = {
  period: "week" | "month" | "year";
  sales: Array<{
    method: "CASH" | "CARD" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "OTHER";
    count: number;
    amount: number;
  }>;
  purchases: Array<{
    method: "CASH" | "CARD" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "OTHER";
    count: number;
    amount: number;
  }>;
};

export type DashboardForecast = {
  method: string;
  historicalMonthly: Array<{ month: string; sales: number }>;
  predictedMonthly: Array<{ month: string; value: number }>;
};

export type DashboardForecastResponse = {
  profit: DashboardProfit;
  forecast: DashboardForecast;
};

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  provider: string;
  image?: string | null;
  is_email_verified: boolean;
};

export type UpdateProfilePayload = {
  name?: string;
  email?: string;
};

export type UpdatePasswordPayload = {
  current_password: string;
  password: string;
  confirm_password: string;
};

export type TemplateSectionRecord = {
  id: number;
  template_id: number;
  section_key: string;
  section_order: number;
  is_default: boolean;
};

export type TemplateRecord = {
  id: number;
  name: string;
  description?: string | null;
  layout_config: {
    primaryColor: string;
    font: string;
    tableStyle: "minimal" | "grid" | "modern";
    layout: "stacked" | "split";
  };
  created_at: string;
  sections?: TemplateSectionRecord[];
};

export type UserTemplateSetting = {
  id: number;
  user_id: number;
  template_id: number;
  enabled_sections: string[];
  theme_color?: string | null;
  section_order: string[];
  design_config?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type UserSavedTemplateRecord = {
  id: number;
  user_id: number;
  name: string;
  base_template_id?: number | null;
  enabled_sections: string[];
  section_order: string[];
  theme_color?: string | null;
  design_config?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type BusinessProfileRecord = {
  id: number;
  user_id: number;
  business_name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
  tax_id?: string | null;
  currency: string;
  show_logo_on_invoice: boolean;
  show_tax_number: boolean;
  show_payment_qr: boolean;
  created_at: string;
  updated_at: string;
};

export const fetchReportsSummary = async (): Promise<ReportsSummary> => {
  const response = await apiClient.get("/reports/summary");
  return response.data.data as ReportsSummary;
};

export const fetchProducts = async (): Promise<Product[]> => {
  const response = await apiClient.get("/products");
  return normalizeListResponse<Product>(response.data?.data);
};

export const createProduct = async (
  payload: ProductInput,
): Promise<Product> => {
  const response = await apiClient.post("/products", payload);
  return response.data.data as Product;
};

export const updateProduct = async (
  id: number,
  payload: Partial<ProductInput>,
): Promise<void> => {
  await apiClient.put(`/products/${id}`, payload);
};

export const deleteProduct = async (id: number): Promise<void> => {
  await apiClient.delete(`/products/${id}`);
};

export const fetchCustomers = async (): Promise<Customer[]> => {
  const response = await apiClient.get("/customers");
  return normalizeListResponse<Customer>(response.data?.data);
};

export const fetchCategories = async (): Promise<Category[]> => {
  const response = await apiClient.get("/categories");
  return response.data.data as Category[];
};

export const createCategory = async (payload: {
  name: string;
}): Promise<Category> => {
  const response = await apiClient.post("/categories", payload);
  return response.data.data as Category;
};

export const createCustomer = async (
  payload: CustomerInput,
): Promise<Customer> => {
  const response = await apiClient.post("/customers", payload);
  return response.data.data as Customer;
};

export const updateCustomer = async (
  id: number,
  payload: Partial<CustomerInput>,
): Promise<void> => {
  await apiClient.put(`/customers/${id}`, payload);
};

export const deleteCustomer = async (id: number): Promise<void> => {
  await apiClient.delete(`/customers/${id}`);
};

export const fetchSuppliers = async (): Promise<Supplier[]> => {
  const response = await apiClient.get("/suppliers");
  return response.data.data as Supplier[];
};

export const createSupplier = async (
  payload: SupplierInput,
): Promise<Supplier> => {
  const response = await apiClient.post("/suppliers", payload);
  return response.data.data as Supplier;
};

export const updateSupplier = async (
  id: number,
  payload: Partial<SupplierInput>,
): Promise<void> => {
  await apiClient.put(`/suppliers/${id}`, payload);
};

export const deleteSupplier = async (id: number): Promise<void> => {
  await apiClient.delete(`/suppliers/${id}`);
};

export const fetchPurchases = async (): Promise<Purchase[]> => {
  const response = await apiClient.get("/purchases");
  return response.data.data as Purchase[];
};

export const createPurchase = async (
  payload: PurchaseInput,
): Promise<Purchase> => {
  const response = await apiClient.post("/purchases", payload);
  return response.data.data as Purchase;
};

export const updatePurchase = async (
  id: number,
  payload: PurchaseInput,
): Promise<Purchase> => {
  const response = await apiClient.put(`/purchases/${id}`, payload);
  return response.data.data as Purchase;
};

export const fetchSales = async (): Promise<Sale[]> => {
  const response = await apiClient.get("/sales");
  return response.data.data as Sale[];
};

export const createSale = async (payload: SaleInput): Promise<Sale> => {
  const response = await apiClient.post("/sales", payload);
  return response.data.data as Sale;
};

export const updateSale = async (
  id: number,
  payload: {
    status?: string;
    notes?: string;
    payment_status?: "PAID" | "PARTIALLY_PAID" | "UNPAID";
    amount_paid?: number;
    payment_date?: string | Date | null;
    payment_method?:
    | "CASH"
    | "CARD"
    | "BANK_TRANSFER"
    | "UPI"
    | "CHEQUE"
    | "OTHER";
  },
): Promise<void> => {
  await apiClient.put(`/sales/${id}`, payload);
};

export const deleteSale = async (id: number): Promise<void> => {
  await apiClient.delete(`/sales/${id}`);
};

export const fetchInvoices = async (): Promise<Invoice[]> => {
  const response = await apiClient.get("/invoices");
  return response.data.data as Invoice[];
};

export const fetchInvoice = async (invoiceId: number): Promise<Invoice> => {
  const response = await apiClient.get(`/invoices/${invoiceId}`);
  return response.data.data as Invoice;
};

export const createInvoice = async (
  payload: InvoiceInput,
): Promise<Invoice> => {
  const response = await apiClient.post("/invoices", payload);
  return response.data.data as Invoice;
};

export const updateInvoice = async (
  invoiceId: number,
  payload: {
    status?: string;
    due_date?: string | Date | null;
    notes?: string | null;
  },
): Promise<void> => {
  await apiClient.put(`/invoices/${invoiceId}`, payload);
};

export const deleteInvoice = async (invoiceId: number): Promise<void> => {
  await apiClient.delete(`/invoices/${invoiceId}`);
};

export const createPayment = async (payload: PaymentInput): Promise<void> => {
  await apiClient.post("/payments", payload);
};

export const sendInvoiceEmail = async (
  invoiceId: number,
): Promise<{ invoiceId: number; status?: string }> => {
  const response = await apiClient.post(`/invoices/${invoiceId}/send`);
  return (response.data?.data ?? { invoiceId }) as {
    invoiceId: number;
    status?: string;
  };
};

export const sendInvoiceReminder = async (
  invoiceId: number,
): Promise<{ invoiceId: number }> => {
  const response = await apiClient.post(`/invoices/${invoiceId}/reminder`);
  return (response.data?.data ?? { invoiceId }) as { invoiceId: number };
};

const parsePdfFileName = (
  contentDisposition: string | undefined,
  fallback: string,
) => {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).replace(/"/g, "");
  }
  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }
  return fallback;
};

export const fetchInvoicePdfFile = async (
  invoiceId: number,
  fallbackInvoiceNumber?: string,
): Promise<{ blob: Blob; fileName: string }> => {
  const response = await apiClient.get(`/invoices/${invoiceId}/pdf`, {
    responseType: "blob",
  });

  const fallback = `${fallbackInvoiceNumber || `invoice-${invoiceId}`}.pdf`;
  const disposition = response.headers?.["content-disposition"] as
    | string
    | undefined;

  return {
    blob: response.data as Blob,
    fileName: parsePdfFileName(disposition, fallback),
  };
};

export const fetchWarehouses = async (): Promise<Warehouse[]> => {
  const response = await apiClient.get("/warehouses");
  return response.data.data as Warehouse[];
};

export const createWarehouse = async (
  payload: WarehouseInput,
): Promise<Warehouse> => {
  const response = await apiClient.post("/warehouses", payload);
  return response.data.data as Warehouse;
};

export const updateWarehouse = async (
  id: number,
  payload: Partial<WarehouseInput>,
): Promise<void> => {
  await apiClient.put(`/warehouses/${id}`, payload);
};

export const deleteWarehouse = async (id: number): Promise<void> => {
  await apiClient.delete(`/warehouses/${id}`);
};

export const fetchWarehouse = async (
  warehouseId: number,
): Promise<Warehouse> => {
  const response = await apiClient.get(`/warehouses/${warehouseId}`);
  return response.data.data as Warehouse;
};

export const fetchInventories = async (
  warehouseId?: number,
): Promise<Inventory[]> => {
  const response = await apiClient.get("/inventories", {
    params: warehouseId ? { warehouse_id: warehouseId } : undefined,
  });
  return response.data.data as Inventory[];
};

export const adjustInventory = async (
  payload: InventoryAdjustInput,
): Promise<{ inventory: Inventory; product: Product }> => {
  const response = await apiClient.post("/inventories/adjust", payload);
  return response.data.data as { inventory: Inventory; product: Product };
};

export const fetchDashboardOverview = async (
  filters?: DashboardOverviewFilters,
): Promise<DashboardOverview> => {
  const response = await apiClient.get("/dashboard/overview", {
    params: buildDashboardFilterParams(filters),
  });
  return response.data.data as DashboardOverview;
};

export const fetchDashboardCardMetrics = async (
  filters?: DashboardOverviewFilters,
): Promise<DashboardCardMetrics> => {
  const response = await apiClient.get("/dashboard/metrics", {
    params: buildDashboardFilterParams(filters),
  });
  return response.data.data as DashboardCardMetrics;
};

export const fetchDashboardSales = async (
  filters?: DashboardOverviewFilters,
): Promise<DashboardSales> => {
  const response = await apiClient.get("/dashboard/sales", {
    params: buildDashboardFilterParams(filters),
  });
  return response.data.data as DashboardSales;
};

export const fetchDashboardInventory =
  async (): Promise<DashboardInventory> => {
    const response = await apiClient.get("/dashboard/inventory");
    return response.data.data as DashboardInventory;
  };

export const fetchDashboardProductSales = async (
  period: "lifetime" | "month" | "week" | "year" = "lifetime"
): Promise<DashboardProductSales> => {
  const response = await apiClient.get("/dashboard/product-sales", {
    params: { period },
  });
  return response.data.data as DashboardProductSales;
};

export const fetchDashboardPaymentMethods = async (
  period: "week" | "month" | "year" = "month",
): Promise<DashboardPaymentMethods> => {
  const response = await apiClient.get("/dashboard/payment-methods", {
    params: { period },
  });
  return response.data.data as DashboardPaymentMethods;
};

export const fetchDashboardTransactions =
  async (filters?: DashboardOverviewFilters): Promise<DashboardTransactions> => {
    const response = await apiClient.get("/dashboard/transactions", {
      params: buildDashboardFilterParams(filters),
    });
    return response.data.data as DashboardTransactions;
  };

export const fetchDashboardCustomers =
  async (): Promise<DashboardCustomers> => {
    const response = await apiClient.get("/dashboard/customers");
    return response.data.data as DashboardCustomers;
  };

export const fetchDashboardSuppliers =
  async (): Promise<DashboardSuppliers> => {
    const response = await apiClient.get("/dashboard/suppliers");
    return response.data.data as DashboardSuppliers;
  };

export const fetchDashboardCashflow = async (): Promise<DashboardCashflow> => {
  const response = await apiClient.get("/dashboard/cashflow", {
    params: { inflowMode: "hybrid" },
  });
  return response.data.data as DashboardCashflow;
};

export const fetchDashboardForecast =
  async (): Promise<DashboardForecastResponse> => {
    const response = await apiClient.get("/dashboard/forecast");
    return response.data.data as DashboardForecastResponse;
  };

export const fetchUserProfile = async (): Promise<UserProfile> => {
  const response = await apiClient.get("/users/me");
  return response.data.data as UserProfile;
};

export const updateUserProfile = async (
  payload: UpdateProfilePayload,
): Promise<UserProfile> => {
  const response = await apiClient.put("/users/me", payload);
  return response.data.data as UserProfile;
};

export const updateUserPassword = async (
  payload: UpdatePasswordPayload,
): Promise<void> => {
  await apiClient.put("/users/password", payload);
};

export const deleteUserData = async (): Promise<void> => {
  await apiClient.delete("/user/data");
};

export const deleteUserAccount = async (): Promise<void> => {
  await apiClient.delete("/user/account");
};

export const fetchTemplates = async (): Promise<TemplateRecord[]> => {
  const response = await apiClient.get("/templates");
  return response.data.data as TemplateRecord[];
};

export const fetchUserTemplates = async (): Promise<UserTemplateSetting[]> => {
  const response = await apiClient.get("/user-template");
  return response.data.data as UserTemplateSetting[];
};

export const saveUserTemplate = async (payload: {
  template_id: number;
  enabled_sections: string[];
  theme_color?: string | null;
  section_order: string[];
  design_config?: Record<string, unknown> | null;
}): Promise<UserTemplateSetting> => {
  const response = await apiClient.post("/user-template", payload);
  return response.data.data as UserTemplateSetting;
};

export const fetchUserSavedTemplates = async (): Promise<
  UserSavedTemplateRecord[]
> => {
  const response = await apiClient.get("/user-saved-templates");
  return response.data.data as UserSavedTemplateRecord[];
};

export const createUserSavedTemplate = async (payload: {
  name: string;
  base_template_id?: number;
  enabled_sections: string[];
  section_order: string[];
  theme_color?: string | null;
  design_config?: Record<string, unknown> | null;
}): Promise<UserSavedTemplateRecord> => {
  const response = await apiClient.post("/user-saved-templates", payload);
  return response.data.data as UserSavedTemplateRecord;
};

export const updateUserSavedTemplate = async (
  id: number,
  payload: {
    name?: string;
    base_template_id?: number;
    enabled_sections?: string[];
    section_order?: string[];
    theme_color?: string | null;
    design_config?: Record<string, unknown> | null;
  },
): Promise<UserSavedTemplateRecord> => {
  const response = await apiClient.put(`/user-saved-templates/${id}`, payload);
  return response.data.data as UserSavedTemplateRecord;
};

export const deleteUserSavedTemplate = async (id: number): Promise<void> => {
  await apiClient.delete(`/user-saved-templates/${id}`);
};

export const fetchBusinessProfile =
  async (): Promise<BusinessProfileRecord | null> => {
    const response = await apiClient.get("/business-profile");
    return (response.data.data as BusinessProfileRecord | null) ?? null;
  };

export const saveBusinessProfile = async (payload: {
  business_name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  tax_id?: string;
  currency: string;
  show_logo_on_invoice?: boolean;
  show_tax_number?: boolean;
  show_payment_qr?: boolean;
}): Promise<BusinessProfileRecord> => {
  const toOptional = (value?: string) => {
    const next = value?.trim();
    return next ? next : undefined;
  };

  const normalizedPayload = {
    business_name: payload.business_name.trim(),
    address: toOptional(payload.address),
    phone: toOptional(payload.phone),
    email: toOptional(payload.email),
    website: toOptional(payload.website),
    logo_url: toOptional(payload.logo_url),
    tax_id: toOptional(payload.tax_id),
    currency: payload.currency.trim() || "INR",
    show_logo_on_invoice: payload.show_logo_on_invoice,
    show_tax_number: payload.show_tax_number,
    show_payment_qr: payload.show_payment_qr,
  };

  const response = await apiClient.post("/business-profile", normalizedPayload);
  return response.data.data as BusinessProfileRecord;
};

// ── Logo management ──────────────────────────────────────────────────────────

/** Fetch the current logo URL */
export const fetchLogoUrl = async (): Promise<string | null> => {
  const response = await apiClient.get("/logo");
  return (response.data?.data?.logo_url as string | null) ?? null;
};

/** Upload a logo for the first time (409 if one already exists → use replaceLogo). */
export const uploadLogo = async (
  file: File,
): Promise<{ logo_url: string }> => {
  const form = new FormData();
  form.append("logo", file);
  const response = await apiClient.post("/logo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data as { logo_url: string };
};

/** Replace the existing logo with a new file. */
export const replaceLogo = async (
  file: File,
): Promise<{ logo_url: string }> => {
  const form = new FormData();
  form.append("logo", file);
  const response = await apiClient.put("/logo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data as { logo_url: string };
};

/** Delete the current logo. */
export const removeLogo = async (): Promise<void> => {
  await apiClient.delete("/logo");
};

export default apiClient;

