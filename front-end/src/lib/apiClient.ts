import axios from "axios";
import { getSession } from "next-auth/react";
import type {
  AssistantHistoryMessage as SharedAssistantHistoryMessage,
  AssistantReply as SharedAssistantReply,
} from "../../../server/src/modules/assistant/assistant.contract";
import { API_URL } from "./apiEndPoints";
import type { InvoiceRenderPayload } from "./invoiceRenderPayload";
import {
  formatBusinessAddress,
  parseBusinessAddressText,
  toBusinessAddressInput,
} from "./indianAddress";
import {
  sanitizeBusinessAddressLine,
  sanitizeBusinessCity,
  sanitizeBusinessCurrency,
  sanitizeBusinessEmail,
  sanitizeBusinessName,
  sanitizeBusinessPhone,
  sanitizeBusinessPincode,
  sanitizeBusinessState,
  sanitizeBusinessTaxId,
  sanitizeBusinessWebsite,
} from "./businessProfileValidation";
import { normalizeListResponse } from "./normalizeListResponse";
import { captureApiFailure } from "./observability/shared";
import { normalizeGstin } from "./gstin";
import {
  bootstrapSecureAuthSession,
  clearLegacyStoredToken,
  clearSecureAuthBootstrapped,
  getLegacyStoredToken,
  hasSecureAuthBootstrap,
  isAuthTokenExpired,
  isSecureAuthSessionExpired,
  isCookieOnlyAuthEnabled,
  isSecureAuthEnabled,
  normalizeAuthToken,
  refreshSecureAuthSessionDetailed,
  requestClientLogout,
  setLegacyStoredToken,
} from "./secureAuth";

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const isFaceAuthenticationRequest = (requestUrl: string) =>
  requestUrl.includes("/face/authenticate");

apiClient.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    config.withCredentials = true;
    const secureAuthEnabled = isSecureAuthEnabled();
    const secureCookieReady = secureAuthEnabled && hasSecureAuthBootstrap();
    const secureCookieExpired =
      secureCookieReady && isSecureAuthSessionExpired();
    const session = !isCookieOnlyAuthEnabled() ? await getSession() : null;
    const sessionToken = normalizeAuthToken(
      (session?.user as { token?: string } | undefined)?.token ?? null,
    );

    let token =
      !secureCookieReady || !secureAuthEnabled
        ? sessionToken ?? getLegacyStoredToken()
        : null;

    if (sessionToken) {
      setLegacyStoredToken(sessionToken);
    } else if (!token) {
      clearLegacyStoredToken();
    }

    if (secureCookieExpired) {
      const refreshResult = await refreshSecureAuthSessionDetailed();
      if (!refreshResult.ok) {
        if (refreshResult.reason === "auth_invalid") {
          requestClientLogout("refresh_expired");
        }
        return Promise.reject(new axios.CanceledError("Session expired"));
      }
    } else if (!secureCookieReady && token && isAuthTokenExpired(token)) {
      if (secureAuthEnabled) {
        const refreshResult = await refreshSecureAuthSessionDetailed();
        if (refreshResult.ok) {
          if (config.headers?.Authorization) {
            delete config.headers.Authorization;
          }
          return config;
        }

        if (refreshResult.reason === "auth_invalid") {
          requestClientLogout("refresh_expired");
        }
        return Promise.reject(new axios.CanceledError("Session expired"));
      } else {
        requestClientLogout("token_expired");
        return Promise.reject(new axios.CanceledError("Session expired"));
      }
    }

    if (!secureCookieReady && token && !isAuthTokenExpired(token)) {
      const header = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
      config.headers.Authorization = header;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    captureApiFailure(error);

    if (typeof window !== "undefined") {
      const status = Number(error?.response?.status ?? 0);
      const payload = error?.response?.data;
      const code =
        typeof payload?.code === "string"
          ? payload.code
          : typeof payload?.error?.code === "string"
            ? payload.error.code
            : null;

      if (
        status === 402 &&
        (code === "SUBSCRIPTION_REQUIRED" || code === "PLAN_LIMIT_REACHED")
      ) {
        window.dispatchEvent(
          new CustomEvent("billsutra:subscription-required", {
            detail: {
              code,
              message:
                typeof payload?.message === "string"
                  ? payload.message
                  : "This feature requires a higher plan.",
              requiredPlan:
                typeof payload?.requiredPlan === "string"
                  ? payload.requiredPlan
                  : null,
            },
          }),
        );
      }

      const originalRequest = error?.config as
        | (typeof error.config & {
            _retry?: boolean;
            _authRefreshTransientFailure?: boolean;
            _authRefreshInvalid?: boolean;
          })
        | undefined;
      const requestUrl =
        typeof originalRequest?.url === "string" ? originalRequest.url : "";
      const isRefreshRequest =
        requestUrl.includes("/auth/refresh") ||
        requestUrl.includes("/auth/logout") ||
        requestUrl.includes("/auth/session/bootstrap");
      const isFaceAuthRequest = isFaceAuthenticationRequest(requestUrl);

      if (
        isSecureAuthEnabled() &&
        status === 401 &&
        !isRefreshRequest &&
        !isFaceAuthRequest &&
        originalRequest &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;

        try {
          const refreshResult = await refreshSecureAuthSessionDetailed();
          if (!refreshResult.ok) {
            if (refreshResult.reason !== "auth_invalid") {
              originalRequest._authRefreshTransientFailure = true;
              return Promise.reject(error);
            }

            originalRequest._authRefreshInvalid = true;
            throw new Error("Unable to refresh session");
          }

          if (originalRequest.headers?.Authorization) {
            delete originalRequest.headers.Authorization;
          }

          originalRequest.withCredentials = true;
          return apiClient(originalRequest);
        } catch (refreshError) {
          captureApiFailure(refreshError);

          clearSecureAuthBootstrapped();
          const session = await getSession();
          const sessionToken = normalizeAuthToken(
            (session?.user as { token?: string } | undefined)?.token ?? null,
          );

          if (
            originalRequest._authRefreshInvalid &&
            sessionToken &&
            !isAuthTokenExpired(sessionToken)
          ) {
            setLegacyStoredToken(sessionToken);

            const bootstrapped = await bootstrapSecureAuthSession(sessionToken);
            if (bootstrapped) {
              if (originalRequest.headers?.Authorization) {
                delete originalRequest.headers.Authorization;
              }

              originalRequest.withCredentials = true;
              return apiClient(originalRequest);
            }

            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = sessionToken.startsWith(
              "Bearer ",
            )
              ? sessionToken
              : `Bearer ${sessionToken}`;
            originalRequest.withCredentials = true;
            return apiClient(originalRequest);
          }

          const legacyToken = getLegacyStoredToken();
          if (
            originalRequest._authRefreshInvalid &&
            legacyToken &&
            !isAuthTokenExpired(legacyToken)
          ) {
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = legacyToken.startsWith(
              "Bearer ",
            )
              ? legacyToken
              : `Bearer ${legacyToken}`;
            originalRequest.withCredentials = true;
            return apiClient(originalRequest);
          }

          if (originalRequest._authRefreshInvalid) {
            clearLegacyStoredToken();
            requestClientLogout("refresh_expired");
          }
        }
      }

      if (
        status === 401 &&
        !isRefreshRequest &&
        !isFaceAuthRequest &&
        (!isSecureAuthEnabled() || originalRequest?._authRefreshInvalid)
      ) {
        requestClientLogout("unauthorized");
      }
    }

    return Promise.reject(error);
  },
);

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

export type ProductImportValidRow = {
  rowNumber: number;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost?: number;
  gstRate: number;
  stock: number;
  reorderLevel: number;
  category?: string;
};

export type ProductImportInvalidRow = {
  rowNumber: number;
  values: {
    name: string;
    sku: string;
    barcode: string;
    sellingPrice: string;
    costPrice: string;
    gstRate: string;
    openingStock: string;
    reorderLevel: string;
    category: string;
  };
  errors: string[];
};

export type ProductImportPreview = {
  previewToken: string;
  fileName: string;
  totalRows: number;
  validRows: ProductImportValidRow[];
  invalidRows: ProductImportInvalidRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    expiresAt: string;
  };
};

export type ProductImportConfirmResult = {
  importedCount: number;
  skippedCount: number;
  errors: Array<{
    rowNumber: number;
    message: string;
  }>;
};

export type ProductInput = {
  name: string;
  sku?: string;
  price: number;
  cost?: number | null;
  barcode?: string | null;
  gst_rate?: number | null;
  stock_on_hand?: number | null;
  reorder_level?: number | null;
  category_id?: number | null;
};

export type ProductListParams = {
  page?: number;
  limit?: number;
  category?: string | null;
  search?: string | null;
};

export type ProductListResponse = {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ExportResource = "products" | "customers" | "invoices";
export type ExportFormat = "csv" | "xlsx" | "pdf" | "json";
export type ExportScope = "all" | "filtered" | "selected";
export type ExportDelivery = "download" | "email";

export type ExportFilters = {
  start_date?: string;
  end_date?: string;
  category?: string;
  payment_status?: string;
  customer_name?: string;
  search?: string;
};

export type ExportRequest = {
  resource: ExportResource;
  format: ExportFormat;
  scope: ExportScope;
  delivery: ExportDelivery;
  email?: string;
  fields: string[];
  selected_ids?: number[];
  filters?: ExportFilters;
};

export type ExportResponse =
  | {
      delivery: "download";
      blob: Blob;
      fileName: string;
    }
  | {
      delivery: "email";
      fileName: string;
      email: string;
      exportedCount: number;
      message: string;
    };

export type ExportPreviewResponse = {
  totalCount: number;
  previewCount: number;
  columns: Array<{ id: string; label: string }>;
  rows: string[][];
};

export type CustomerType = "individual" | "business";

export type CustomerPaymentTerms =
  | "DUE_ON_RECEIPT"
  | "NET_7"
  | "NET_15"
  | "NET_30";

export type CustomerAddressRecord = {
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
};

export type Customer = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  type?: CustomerType;
  customer_type?: CustomerType;
  businessName?: string | null;
  business_name?: string | null;
  gstin?: string | null;
  customerAddress?: CustomerAddressRecord | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  notes?: string | null;
  creditLimit?: number | null;
  credit_limit?: number | null;
  paymentTerms?: CustomerPaymentTerms | null;
  payment_terms?: CustomerPaymentTerms | null;
  openingBalance?: number | null;
  opening_balance?: number | null;
  display_name?: string | null;
  totalBilled?: number;
  totalPaid?: number;
  outstandingBalance?: number;
  openInvoiceCount?: number;
  settled?: boolean;
  lastPaymentDate?: string | null;
  lastActivityDate?: string | null;
  openInvoices?: Array<{
    id: number;
    invoiceNumber: string;
    issueDate: string;
    dueDate?: string | null;
    status: string;
    total: number;
    paid: number;
    remaining: number;
  }>;
};

export type CustomerInput = {
  type?: CustomerType;
  customer_type?: CustomerType;
  name: string;
  phone: string;
  email?: string | null;
  businessName?: string | null;
  business_name?: string | null;
  gstin?: string | null;
  customerAddress?: Partial<CustomerAddressRecord> | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  address?: string | null;
  notes?: string | null;
  creditLimit?: number | null;
  credit_limit?: number | null;
  paymentTerms?: CustomerPaymentTerms | null;
  payment_terms?: CustomerPaymentTerms | null;
  openingBalance?: number | null;
  opening_balance?: number | null;
};

export type CustomerListParams = {
  page?: number;
  limit?: number;
  search?: string | null;
};

export type CustomerLedgerEntry = {
  id: string;
  type: "invoice" | "payment";
  invoiceId?: number | null;
  paymentId?: number | null;
  date: string;
  description: string;
  note?: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export type CustomerLedger = {
  customer: Customer;
  summary: {
    totalBilled: number;
    totalPaid: number;
    outstandingBalance: number;
    openInvoiceCount: number;
    settled: boolean;
    lastPaymentDate?: string | null;
    lastActivityDate?: string | null;
    openInvoices: Array<{
      id: number;
      invoiceNumber: string;
      issueDate: string;
      dueDate?: string | null;
      status: string;
      total: number;
      paid: number;
      remaining: number;
    }>;
  };
  entries: CustomerLedgerEntry[];
};

export type Supplier = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  categories?: string[];
  businessName?: string | null;
  business_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  supplierAddress?: SupplierAddressRecord | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  paymentTerms?: SupplierPaymentTerms | null;
  payment_terms?: SupplierPaymentTerms | null;
  openingBalance?: number | null;
  opening_balance?: number | null;
  notes?: string | null;
  outstandingBalance?: number | null;
  outstanding_balance?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type SupplierPaymentTerms = "NET_7" | "NET_15" | "NET_30";

export type SupplierAddressRecord = {
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
};

export type SupplierInput = {
  name: string;
  phone: string;
  email?: string | null;
  categories?: string[];
  businessName?: string | null;
  business_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  supplierAddress?: Partial<SupplierAddressRecord> | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  paymentTerms?: SupplierPaymentTerms | null;
  payment_terms?: SupplierPaymentTerms | null;
  openingBalance?: number | null;
  opening_balance?: number | null;
  notes?: string | null;
  address?: string | null;
};

export type Worker = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "ADMIN" | "WORKER";
  businessId: string;
  createdAt: string;
  roleLabel?: "ADMIN" | "SALESPERSON" | "STAFF" | "VIEWER";
  status?: "ACTIVE" | "INACTIVE";
  joiningDate?: string | null;
  incentiveType?: "NONE" | "PERCENTAGE" | "PER_SALE";
  incentiveValue?: number;
  lastActiveAt?: string | null;
  metrics?: {
    totalSales: number;
    totalInvoices: number;
    totalOrders: number;
    averageOrderValue: number;
    incentiveEarned: number;
    thisMonthSales: number;
  };
};

export type WorkerOverviewResponse = {
  workers: Worker[];
  summary: {
    totalSales: number;
    totalOrders: number;
    incentiveEarned: number;
    thisMonthSales: number;
  };
  recentActivity: Array<{
    workerId: string;
    workerName: string;
    activityType: "SALE" | "INVOICE";
    reference: string;
    amount: number;
    createdAt: string;
  }>;
  leaderboard: Array<{
    rank: number;
    workerId: string;
    name: string;
    totalSales: number;
    totalOrders: number;
  }>;
};

export type WorkerInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  accessRole?: "ADMIN" | "SALESPERSON" | "STAFF" | "VIEWER";
  joiningDate?: string;
  status?: "ACTIVE" | "INACTIVE";
  incentiveType?: "NONE" | "PERCENTAGE" | "PER_SALE";
  incentiveValue?: number;
};

export type WorkerUpdateInput = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  accessRole?: "ADMIN" | "SALESPERSON" | "STAFF" | "VIEWER";
  joiningDate?: string;
  status?: "ACTIVE" | "INACTIVE";
  incentiveType?: "NONE" | "PERCENTAGE" | "PER_SALE";
  incentiveValue?: number;
};

// Worker Panel types
export type WorkerProfileResponse = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  accessRole: string;
  status: string;
  joiningDate: string | null;
  createdAt: string;
};

export type WorkerDashboardOverviewResponse = {
  metrics: {
    totalInvoices: number;
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    thisMonthSales: number;
    incentiveEarned: number;
  };
};

export type WorkerIncentiveResponse = {
  totalIncentiveEarned: number;
  incentiveType: "NONE" | "PERCENTAGE" | "PER_SALE";
  incentiveValue: number;
  calculationNote: string;
  monthlyBreakdown: Array<{ month: string; incentive: number }>;
};

export type WorkerHistoryEntry = {
  id: string;
  type: "INVOICE" | "SALE";
  reference: string;
  customerName: string | null;
  amount: number;
  status: string;
  date: string;
};

export type WorkerHistoryResponse = {
  entries: WorkerHistoryEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type WorkerHistoryParams = {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  minAmount?: string;
  maxAmount?: string;
  search?: string;
};

export type Purchase = {
  id: number;
  purchase_date: string;
  supplierId?: number | null;
  warehouseId?: number | null;
  subtotal: string;
  tax: string;
  total: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
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
    purchaseId?: number | null;
    product_id?: number | null;
    productId?: number | null;
    name: string;
    quantity: number;
    unit_cost: string;
    costPrice?: number;
    tax_rate?: string | null;
    line_total: string;
    total?: number;
  }>;
};

export type PurchaseListParams = {
  page?: number;
  limit?: number;
  search?: string | null;
};

export type PurchaseListResponse = {
  purchases: Purchase[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
  computedStatus?: "PAID" | "PARTIAL" | "UNPAID";
  subtotal: string;
  total_base?: string | null;
  tax: string;
  tax_mode?: "CGST_SGST" | "IGST" | "NONE" | null;
  total_cgst?: string | null;
  total_sgst?: string | null;
  total_igst?: string | null;
  discount: string;
  discount_type?: "PERCENTAGE" | "FIXED" | null;
  discount_value?: string | null;
  discount_calculated?: string | null;
  total: string;
  grand_total?: string | null;
  notes?: string | null;
  template_snapshot?: InvoiceTemplateSnapshot | null;
  totalPaid?: number;
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
    nonInventoryItem?: boolean;
    price: string;
    tax_rate?: string | null;
    gst_type?: "CGST_SGST" | "IGST" | "NONE" | null;
    base_amount?: string | null;
    gst_amount?: string | null;
    cgst_amount?: string | null;
    sgst_amount?: string | null;
    igst_amount?: string | null;
    total: string;
  }>;
};

export type InvoiceTemplateSnapshot = {
  templateId?: string | null;
  templateName?: string | null;
  enabledSections: string[];
  sectionOrder?: string[];
  theme?: Record<string, unknown> | null;
  designConfig?: Record<string, unknown> | null;
};

export type InvoiceBootstrap = {
  customers: Array<{
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  }>;
  products: Product[];
  warehouses: Warehouse[];
  defaults: {
    invoiceDate: string;
    dueDate: string;
    taxMode: "CGST_SGST" | "IGST" | "NONE";
    invoiceNumberPreview: string;
  };
};

export type InvoiceInput = {
  customer_id: number;
  date?: string | Date | null;
  due_date?: string | Date | null;
  discount?: number | null;
  discount_type?: "PERCENTAGE" | "FIXED" | null;
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
  tax_mode?: "AUTO" | "CGST_SGST" | "IGST" | "NONE" | null;
  customer_type?: "B2C" | "B2B" | null;
  customer_gstin?: string | null;
  business_gstin?: string | null;
  place_of_supply_state_code?: string | null;
  is_tax_inclusive?: boolean;
  status?: string | null;
  notes?: string | null;
  template_snapshot?: InvoiceTemplateSnapshot | null;
  sync_sales?: boolean;
  warehouse_id?: number | null;
  items: Array<{
    product_id?: number | null;
    name: string;
    quantity: number;
    price: number;
    tax_rate?: number | null;
    gst_type?: "CGST_SGST" | "IGST" | "NONE" | null;
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

export type InventoryDemandAlertLevel = "critical" | "warning" | "normal";

export type InventoryDemandPrediction = {
  product_id: number;
  product_name: string;
  warehouse_id?: number | null;
  stock_left: number;
  predicted_daily_sales: number;
  days_until_stockout: number;
  recommended_reorder_quantity: number;
  alert_level: InventoryDemandAlertLevel;
  unit_cost: number;
  basis_window_days: number;
  confidence: number;
};

export type InventoryDemandPredictionsMetadata = {
  generatedAt: string;
  basisWindowDays: number;
  dataCoverageDays: number;
  warehouseScope: {
    warehouseId: number | null;
    mode: "all" | "warehouse";
  };
};

export type InventoryDemandPredictionsResponse = {
  predictions: InventoryDemandPrediction[];
  count: number;
  metadata: InventoryDemandPredictionsMetadata;
};

export type InventoryDemandPredictionFilters = {
  productId?: number;
  warehouseId?: number;
  productIds?: number[];
  categoryId?: number;
  supplierId?: number;
  alertLevel?: InventoryDemandAlertLevel;
  limit?: number;
};

export type InventoryInsightType =
  | "low_stock"
  | "out_of_stock"
  | "prediction"
  | "slow_moving"
  | "reorder_reminder"
  | "supplier_suggestion";

export type InventoryInsightSeverity = "critical" | "warning" | "info";

export type InventoryInsight = {
  id: string;
  productId: string;
  productName: string;
  warehouseId: number | null;
  warehouseName: string | null;
  type: InventoryInsightType;
  message: string;
  severity: InventoryInsightSeverity;
  suggestedQuantity?: number;
  suggestedSupplierId?: number | null;
  suggestedSupplierName?: string | null;
  daysToStockout?: number | null;
  avgDailySales?: number;
  unitCost?: number;
  stockLeft: number;
  threshold?: number;
  referenceKey: string;
};

export type InventoryInsightsResponse = {
  generatedAt: string;
  summary: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
  insights: InventoryInsight[];
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

export type PaymentUpdateInput = Partial<Omit<PaymentInput, "invoice_id">>;

export type AccessPaymentRecord = {
  id: string;
  userId: number;
  planId: "pro" | "pro-plus";
  billingCycle: "monthly" | "yearly";
  method: "razorpay" | "upi";
  amount: number;
  status: "pending" | "approved" | "rejected" | "success";
  name?: string | null;
  utr?: string | null;
  proofFileId?: string | null;
  proofUrl?: string | null;
  proofMimeType?: string | null;
  proofOriginalName?: string | null;
  proofSize?: number | null;
  proofUploadedAt?: string | null;
  screenshotUrl?: string | null;
  adminNote?: string | null;
  paymentId?: string | null;
  orderId?: string | null;
  provider?: string | null;
  providerReference?: string | null;
  reviewedByAdminId?: string | null;
  reviewedByAdminEmail?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccessPlanOption = {
  id: "pro" | "pro-plus";
  name: string;
  description: string;
  amounts: {
    monthly: number;
    yearly: number;
  };
  currency: "INR";
  upiLink: {
    monthly: string;
    yearly: string;
  };
};

export type SubscriptionSnapshot = {
  planId: "free" | "pro" | "pro-plus";
  planName: string;
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  billingCycle: "monthly" | "yearly" | null;
  startedAt: string;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  usage: {
    periodKey: string;
    periodStart: string;
    periodEnd: string;
    invoicesCreated: number;
    productsCreated: number;
    customersCreated: number;
  };
  limits: {
    invoicesPerMonth: number | null;
  };
};

export type UserPermissions = {
  plan: "free" | "pro" | "pro_plus";
  isSubscribed: boolean;
  features: {
    maxInvoices: number | "unlimited";
    analytics: boolean | "advanced";
    teamAccess: boolean;
    export: boolean;
  };
  usage: {
    invoicesUsed: number;
  };
  limitsReached: {
    invoicesLimitReached: boolean;
  };
};

export type UserSettingsPreferences = {
  appPreferences: {
    language: "en" | "hi";
    currency: "INR" | "USD";
    dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  };
  inventory: {
    allowNegativeStock: boolean;
  };
  notifications: {
    paymentReminders: boolean;
    lowStockAlerts: boolean;
    dueInvoiceAlerts: boolean;
  };
  backup: {
    autoBackupEnabled: boolean;
  };
  branding: {
    templateId: string;
    themeColor: string;
    terms: string;
    signature: string;
  };
};

export type AppNotificationType =
  | "payment"
  | "inventory"
  | "customer"
  | "subscription"
  | "worker";

export type AppNotification = {
  id: string;
  businessId: string;
  type: AppNotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type NotificationListResponse = {
  notifications: AppNotification[];
  unreadCount: number;
};

export type SecurityActivityEvent = {
  id: number;
  method: string;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AccessPaymentStatusResponse = {
  hasAccess: boolean;
  activePayment: AccessPaymentRecord | null;
  subscription: SubscriptionSnapshot;
  payments: AccessPaymentRecord[];
  upi: {
    upiId: string;
    payeeName: string;
  };
  razorpay: {
    keyId: string | null;
    enabled: boolean;
  };
  plans: AccessPlanOption[];
};

export type CreateAccessRazorpayOrderInput = {
  plan_id: "pro" | "pro-plus";
  billing_cycle: "monthly" | "yearly";
};

export type UploadAccessPaymentProofInput = {
  planId: "pro" | "pro-plus";
  billingCycle: "monthly" | "yearly";
  name?: string;
  utr?: string;
  paymentProof: File;
};

export type CreateAccessRazorpayOrderResponse = {
  paymentRecordId: string;
  orderId: string;
  amount: number;
  currency: string;
  plan: {
    planId: "pro" | "pro-plus";
    billingCycle: "monthly" | "yearly";
    amount: number;
    currency: string;
    name: string;
  };
};

export type VerifyAccessRazorpayPaymentInput = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
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

export type DashboardForecastResponse = {
  generatedAt: string;
  basis: {
    averageWindowDays: number;
    historicalWindowMonths: number;
    projectionMonths: number;
  };
  sales: {
    method: string;
    historicalMonthly: Array<{ month: string; receipts: number }>;
    predictedMonthly: Array<{ month: string; receipts: number }>;
    trailing30Days: {
      totalReceipts: number;
      averageDailyReceipts: number;
      previous30DaysTotal: number;
      trendPercent: number;
    };
    projectedNext30Days: number;
  };
  cashflow: {
    trailing30Days: {
      inflow: number;
      outflow: number;
      net: number;
      averageDailyInflow: number;
      averageDailyOutflow: number;
      balanceEstimate: number;
    };
    projected30Days: {
      inflow: number;
      outflow: number;
      net: number;
      closingBalanceEstimate: number;
    };
    predictedMonthly: Array<{
      month: string;
      inflow: number;
      outflow: number;
      net: number;
      closingBalanceEstimate: number;
    }>;
  };
  profit: {
    historicalMonthly: Array<{
      month: string;
      sales: number;
      purchases: number;
      expenses: number;
      profit: number;
      margin: number;
    }>;
    projectedMonthly: Array<{
      month: string;
      sales: number;
      purchases: number;
      expenses: number;
      profit: number;
      margin: number;
    }>;
    trailing30Days: {
      sales: number;
      purchases: number;
      expenses: number;
      profit: number;
      margin: number;
    };
    projected30Days: {
      sales: number;
      purchases: number;
      expenses: number;
      profit: number;
      margin: number;
    };
  };
  receivables: {
    outstanding: number;
  };
  insights: Array<{
    id: string;
    tone: "positive" | "warning" | "critical" | "info";
    title: string;
    message: string;
  }>;
};

export type AssistantReply = SharedAssistantReply;
export type AssistantHistoryMessage = SharedAssistantHistoryMessage;

export type FinancialCopilotPayload = {
  generatedAt: string;
  language: "en" | "hi" | "hinglish";
  overview: {
    headline: string;
    summary: string;
    action: string;
  };
  budget: {
    suggestedMonthlyBudget: number;
    remainingSafeToSpend: number;
    fixedExpensesEstimate: number;
    spentThisMonth: number;
    projectedMonthSpend: number;
    dailySafeSpend: number;
    status: "on_track" | "caution" | "over_budget";
    summary: string;
    action: string;
  };
  savings: {
    summary: string;
    monthlySavingsPotential: number;
    opportunities: Array<{
      id: string;
      title: string;
      description: string;
      potentialMonthlySavings: number;
      category: string;
      priority: "high" | "medium" | "low";
    }>;
  };
  reminders: {
    summary: string;
    items: Array<{
      id: string;
      title: string;
      description: string;
      dueDate: string | null;
      daysUntilDue: number | null;
      monthlyAmount: number;
      priority: "high" | "medium" | "low";
      suggestedAction: string;
      behavior: "early" | "on_time" | "late";
    }>;
  };
  healthScore: {
    score: number;
    band: "excellent" | "good" | "needs_improvement" | "poor";
    summary: string;
    nextBestAction: string;
    breakdown: Array<{
      label: string;
      score: number;
      outOf: number;
    }>;
  };
  behaviorInsights: {
    summary: string;
    items: Array<{
      id: string;
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
    }>;
  };
  nudges: Array<{
    id: string;
    tone: "positive" | "warning" | "critical" | "info";
    message: string;
    action: string;
  }>;
  goals: {
    projectedMonthlySavings: number;
    summary: string;
    items: Array<{
      id: number;
      title: string;
      emoji: string | null;
      targetAmount: number;
      currentAmount: number;
      monthlyContributionTarget: number | null;
      targetDate: string | null;
      progressPercent: number;
      remainingAmount: number;
      projectedCompletionDate: string | null;
      monthsToGoal: number | null;
      summary: string;
    }>;
  };
  decision: {
    amount: number;
    verdict: "safe" | "warning" | "risky";
    summary: string;
    explanation: string;
    suggestedDelayDays: number;
    impactOnBudget: number;
    safeRoomAfterPurchase: number;
    reserveForUpcomingExpenses: number;
    currentBalanceEstimate: number;
    projectedClosingBalance: number;
  } | null;
  examples: string[];
};

export type FinancialGoalRecord = {
  id: number;
  userId: number;
  title: string;
  emoji: string | null;
  targetAmount: number;
  currentAmount: number;
  monthlyContributionTarget: number | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancialGoalInput = {
  title: string;
  emoji?: string | null;
  targetAmount: number;
  currentAmount?: number;
  monthlyContributionTarget?: number | null;
  targetDate?: string | null;
};

export type UserProfile = {
  id: number | string;
  name: string;
  email: string;
  provider: string;
  image?: string | null;
  is_email_verified: boolean;
  role?: "ADMIN" | "WORKER";
  businessId?: string | null;
  account_type?: "OWNER" | "WORKER";
  worker_id?: string | null;
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

export type BusinessAddressRecord = {
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
};

export type BusinessProfileRecord = {
  id: number;
  user_id: number;
  business_name: string;
  address?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  businessAddress?: BusinessAddressRecord | null;
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

export const fetchProducts = async (
  params?: ProductListParams,
): Promise<ProductListResponse> => {
  const searchParams = new URLSearchParams();

  if (params?.page) {
    searchParams.set("page", String(params.page));
  }
  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }
  if (params?.category) {
    searchParams.set("category", params.category);
  }
  if (params?.search) {
    searchParams.set("search", params.search);
  }

  const query = searchParams.toString();
  const response = await apiClient.get(
    query ? `/products?${query}` : "/products",
  );
  const payload = response.data?.data;
  const products = normalizeListResponse<Product>(
    payload?.products ?? payload?.items ?? payload,
  );

  return {
    products,
    total: typeof payload?.total === "number" ? payload.total : products.length,
    page:
      typeof payload?.page === "number" ? payload.page : (params?.page ?? 1),
    limit:
      typeof payload?.limit === "number"
        ? payload.limit
        : (params?.limit ?? products.length),
    totalPages:
      typeof payload?.totalPages === "number" ? payload.totalPages : 1,
  };
};

export const fetchProductOptions = async (
  params?: ProductListParams,
): Promise<Product[]> => {
  const response = await fetchProducts({
    page: params?.page ?? 1,
    limit: params?.limit ?? 1000,
    category: params?.category ?? null,
    search: params?.search ?? null,
  });

  return response.products;
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

export const previewProductImport = async (
  file: File,
  options?: {
    onUploadProgress?: (progress: number) => void;
  },
): Promise<ProductImportPreview> => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await apiClient.post(
      "/import/products/preview",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!options?.onUploadProgress || !event.total) {
            return;
          }

          const progress = Math.min(
            100,
            Math.round((event.loaded / event.total) * 100),
          );
          options.onUploadProgress(progress);
        },
      },
    );

    return response.data.data as ProductImportPreview;
  } catch (error) {
    const message =
      (await extractBlobErrorMessage(error)) ||
      "Unable to validate the uploaded file.";

    throw new Error(message);
  }
};

export const confirmProductImport = async (
  previewToken: string,
): Promise<ProductImportConfirmResult> => {
  try {
    const response = await apiClient.post("/import/products/confirm", {
      preview_token: previewToken,
    });

    return response.data.data as ProductImportConfirmResult;
  } catch (error) {
    const message =
      (await extractBlobErrorMessage(error)) || "Unable to confirm import.";

    throw new Error(message);
  }
};

export const downloadProductImportTemplate = async (): Promise<{
  blob: Blob;
  fileName: string;
}> => {
  try {
    const response = await apiClient.get("/import/templates/products", {
      responseType: "blob",
    });

    const disposition = response.headers?.["content-disposition"] as
      | string
      | undefined;

    return {
      blob: response.data as Blob,
      fileName: parseDownloadFileName(
        disposition,
        "products-import-template.xlsx",
      ),
    };
  } catch (error) {
    const message =
      (await extractBlobErrorMessage(error)) ||
      "Unable to download the product import template.";

    throw new Error(message);
  }
};

const toOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const toOptionalNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toCustomerAddress = (value: {
  address?: string | null;
  addressLine1?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  customerAddress?: Partial<CustomerAddressRecord> | null;
}): CustomerAddressRecord => {
  const parsedLegacy = parseBusinessAddressText(value.address);

  return toBusinessAddressInput({
    addressLine1:
      value.customerAddress?.addressLine1 ??
      value.addressLine1 ??
      value.address_line1 ??
      parsedLegacy.addressLine1,
    city: value.customerAddress?.city ?? value.city ?? parsedLegacy.city,
    state: value.customerAddress?.state ?? value.state ?? parsedLegacy.state,
    pincode:
      value.customerAddress?.pincode ?? value.pincode ?? parsedLegacy.pincode,
  });
};

const normalizeCustomerRecord = (record: Customer): Customer => {
  const source = record as Customer & {
    type?: CustomerType;
    customer_type?: CustomerType;
    businessName?: string | null;
    business_name?: string | null;
    customerAddress?: Partial<CustomerAddressRecord> | null;
    address_line1?: string | null;
    creditLimit?: number | null;
    credit_limit?: number | null;
    paymentTerms?: CustomerPaymentTerms | null;
    payment_terms?: CustomerPaymentTerms | null;
    openingBalance?: number | null;
    opening_balance?: number | null;
  };

  const customerAddress = toCustomerAddress(source);
  const normalizedAddress = formatBusinessAddress(
    customerAddress,
    source.address,
  );
  const customerType =
    source.type ?? source.customer_type ?? ("individual" as CustomerType);

  return {
    ...source,
    type: customerType,
    customer_type: customerType,
    businessName: source.businessName ?? source.business_name ?? null,
    business_name: source.business_name ?? source.businessName ?? null,
    gstin: source.gstin ? normalizeGstin(source.gstin) : null,
    customerAddress,
    address_line1: customerAddress.addressLine1 || null,
    city: customerAddress.city || null,
    state: customerAddress.state || null,
    pincode: customerAddress.pincode || null,
    creditLimit: source.creditLimit ?? source.credit_limit ?? null,
    credit_limit: source.credit_limit ?? source.creditLimit ?? null,
    paymentTerms: source.paymentTerms ?? source.payment_terms ?? null,
    payment_terms: source.payment_terms ?? source.paymentTerms ?? null,
    openingBalance: source.openingBalance ?? source.opening_balance ?? null,
    opening_balance: source.opening_balance ?? source.openingBalance ?? null,
    address: normalizedAddress || null,
  };
};

const normalizeCustomerPayload = (
  payload: Partial<CustomerInput>,
  includeDefaults = false,
) => {
  const normalizedAddress = toCustomerAddress({
    customerAddress: payload.customerAddress ?? null,
    addressLine1:
      payload.customerAddress?.addressLine1 ??
      payload.address_line1 ??
      undefined,
    city: payload.customerAddress?.city ?? payload.city ?? undefined,
    state: payload.customerAddress?.state ?? payload.state ?? undefined,
    pincode: payload.customerAddress?.pincode ?? payload.pincode ?? undefined,
    address: payload.address,
  });

  const hasStructuredAddress = Boolean(
    normalizedAddress.addressLine1 ||
    normalizedAddress.city ||
    normalizedAddress.state ||
    normalizedAddress.pincode,
  );

  const normalizedType =
    payload.type ??
    payload.customer_type ??
    (includeDefaults ? "individual" : undefined);
  const normalizedPaymentTerms =
    payload.paymentTerms ??
    payload.payment_terms ??
    (includeDefaults ? "DUE_ON_RECEIPT" : undefined);

  const normalizedPhone = toOptionalString(payload.phone)?.replace(/\D/g, "");
  const normalizedGstin = toOptionalString(payload.gstin)
    ? normalizeGstin(payload.gstin)
    : undefined;
  const legacyAddress = formatBusinessAddress(
    normalizedAddress,
    payload.address,
  );

  return {
    type: normalizedType,
    customer_type: normalizedType,
    name: toOptionalString(payload.name),
    phone: normalizedPhone,
    email: toOptionalString(payload.email),
    businessName: toOptionalString(
      payload.businessName ?? payload.business_name,
    ),
    business_name: toOptionalString(
      payload.business_name ?? payload.businessName,
    ),
    gstin: normalizedGstin,
    customerAddress: hasStructuredAddress ? normalizedAddress : undefined,
    address_line1: hasStructuredAddress
      ? normalizedAddress.addressLine1
      : undefined,
    city: hasStructuredAddress ? normalizedAddress.city : undefined,
    state: hasStructuredAddress ? normalizedAddress.state : undefined,
    pincode: hasStructuredAddress ? normalizedAddress.pincode : undefined,
    address: toOptionalString(legacyAddress),
    notes: toOptionalString(payload.notes),
    creditLimit: toOptionalNumber(payload.creditLimit ?? payload.credit_limit),
    credit_limit: toOptionalNumber(payload.credit_limit ?? payload.creditLimit),
    paymentTerms: normalizedPaymentTerms,
    payment_terms: normalizedPaymentTerms,
    openingBalance: toOptionalNumber(
      payload.openingBalance ?? payload.opening_balance,
    ),
    opening_balance: toOptionalNumber(
      payload.opening_balance ?? payload.openingBalance,
    ),
  };
};

const normalizePan = (value: string | null | undefined) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

const normalizeSupplierCategories = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique: string[] = [];
  const seen = new Set<string>();

  value.forEach((entry) => {
    if (typeof entry !== "string") {
      return;
    }

    const normalized = entry.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(normalized.slice(0, 60));
  });

  return unique;
};

const toSupplierAddress = (value: {
  address?: string | null;
  addressLine1?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  supplierAddress?: Partial<SupplierAddressRecord> | null;
}): SupplierAddressRecord => {
  const parsedLegacy = parseBusinessAddressText(value.address);

  return toBusinessAddressInput({
    addressLine1:
      value.supplierAddress?.addressLine1 ??
      value.addressLine1 ??
      value.address_line1 ??
      parsedLegacy.addressLine1,
    city: value.supplierAddress?.city ?? value.city ?? parsedLegacy.city,
    state: value.supplierAddress?.state ?? value.state ?? parsedLegacy.state,
    pincode:
      value.supplierAddress?.pincode ?? value.pincode ?? parsedLegacy.pincode,
  });
};

const normalizeSupplierRecord = (record: Supplier): Supplier => {
  const source = record as Supplier & {
    businessName?: string | null;
    business_name?: string | null;
    supplierAddress?: Partial<SupplierAddressRecord> | null;
    address_line1?: string | null;
    paymentTerms?: SupplierPaymentTerms | null;
    payment_terms?: SupplierPaymentTerms | null;
    openingBalance?: number | null;
    opening_balance?: number | null;
    outstandingBalance?: number | null;
    outstanding_balance?: number | null;
  };

  const supplierAddress = toSupplierAddress(source);
  const normalizedAddress = formatBusinessAddress(
    supplierAddress,
    source.address,
  );

  return {
    ...source,
    categories: normalizeSupplierCategories(source.categories),
    businessName: source.businessName ?? source.business_name ?? null,
    business_name: source.business_name ?? source.businessName ?? null,
    gstin: source.gstin ? normalizeGstin(source.gstin) : null,
    pan: source.pan ? normalizePan(source.pan) : null,
    supplierAddress,
    address_line1: supplierAddress.addressLine1 || null,
    city: supplierAddress.city || null,
    state: supplierAddress.state || null,
    pincode: supplierAddress.pincode || null,
    paymentTerms: source.paymentTerms ?? source.payment_terms ?? null,
    payment_terms: source.payment_terms ?? source.paymentTerms ?? null,
    openingBalance:
      toOptionalNumber(source.openingBalance ?? source.opening_balance) ?? null,
    opening_balance:
      toOptionalNumber(source.opening_balance ?? source.openingBalance) ?? null,
    outstandingBalance:
      toOptionalNumber(
        source.outstandingBalance ?? source.outstanding_balance,
      ) ?? null,
    outstanding_balance:
      toOptionalNumber(
        source.outstanding_balance ?? source.outstandingBalance,
      ) ?? null,
    address: normalizedAddress || null,
  };
};

const normalizeSupplierPayload = (
  payload: Partial<SupplierInput>,
  includeDefaults = false,
) => {
  const normalizedAddress = toSupplierAddress({
    supplierAddress: payload.supplierAddress ?? null,
    addressLine1:
      payload.supplierAddress?.addressLine1 ??
      payload.address_line1 ??
      undefined,
    city: payload.supplierAddress?.city ?? payload.city ?? undefined,
    state: payload.supplierAddress?.state ?? payload.state ?? undefined,
    pincode: payload.supplierAddress?.pincode ?? payload.pincode ?? undefined,
    address: payload.address,
  });

  const hasStructuredAddress = Boolean(
    normalizedAddress.addressLine1 ||
    normalizedAddress.city ||
    normalizedAddress.state ||
    normalizedAddress.pincode,
  );

  const normalizedPhone = toOptionalString(payload.phone)?.replace(/\D/g, "");
  const normalizedGstin = toOptionalString(payload.gstin)
    ? normalizeGstin(payload.gstin)
    : undefined;
  const normalizedPan = toOptionalString(payload.pan)
    ? normalizePan(payload.pan)
    : undefined;
  const normalizedPaymentTerms =
    payload.paymentTerms ??
    payload.payment_terms ??
    (includeDefaults ? "NET_15" : undefined);
  const legacyAddress = formatBusinessAddress(
    normalizedAddress,
    payload.address,
  );

  return {
    name: toOptionalString(payload.name),
    phone: normalizedPhone,
    email: toOptionalString(payload.email),
    categories:
      payload.categories === undefined
        ? undefined
        : normalizeSupplierCategories(payload.categories),
    businessName: toOptionalString(
      payload.businessName ?? payload.business_name,
    ),
    business_name: toOptionalString(
      payload.business_name ?? payload.businessName,
    ),
    gstin: normalizedGstin,
    pan: normalizedPan,
    supplierAddress: hasStructuredAddress ? normalizedAddress : undefined,
    address_line1: hasStructuredAddress
      ? normalizedAddress.addressLine1
      : undefined,
    city: hasStructuredAddress ? normalizedAddress.city : undefined,
    state: hasStructuredAddress ? normalizedAddress.state : undefined,
    pincode: hasStructuredAddress ? normalizedAddress.pincode : undefined,
    address: toOptionalString(legacyAddress),
    paymentTerms: normalizedPaymentTerms,
    payment_terms: normalizedPaymentTerms,
    openingBalance: toOptionalNumber(
      payload.openingBalance ?? payload.opening_balance,
    ),
    opening_balance: toOptionalNumber(
      payload.opening_balance ?? payload.openingBalance,
    ),
    notes: toOptionalString(payload.notes),
  };
};

export const fetchCustomers = async (
  params?: CustomerListParams,
): Promise<Customer[]> => {
  const response = await apiClient.get("/customers", {
    params: {
      page: params?.page,
      limit: params?.limit,
      search: params?.search?.trim() || undefined,
    },
  });
  return normalizeListResponse<Customer>(response.data?.data).map(
    normalizeCustomerRecord,
  );
};

export const fetchCustomerLedger = async (
  customerId: number,
): Promise<CustomerLedger> => {
  const response = await apiClient.get(`/customers/${customerId}/ledger`);
  const payload = response.data.data as CustomerLedger;

  return {
    ...payload,
    customer: normalizeCustomerRecord(payload.customer),
  };
};

export const downloadCustomerLedgerPdf = async (customerId: number) => {
  const response = await apiClient.get(`/customers/${customerId}/ledger/pdf`, {
    responseType: "blob",
  });

  const dispositionHeader = response.headers["content-disposition"];
  const fileNameMatch =
    typeof dispositionHeader === "string"
      ? dispositionHeader.match(/filename="?([^"]+)"?/)
      : null;

  return {
    blob: response.data as Blob,
    fileName: fileNameMatch?.[1] || `customer-${customerId}-ledger.pdf`,
  };
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
  const response = await apiClient.post(
    "/customers",
    normalizeCustomerPayload(payload, true),
  );
  return normalizeCustomerRecord(response.data.data as Customer);
};

export const updateCustomer = async (
  id: number,
  payload: Partial<CustomerInput>,
): Promise<void> => {
  await apiClient.put(`/customers/${id}`, normalizeCustomerPayload(payload));
};

export const deleteCustomer = async (id: number): Promise<void> => {
  await apiClient.delete(`/customers/${id}`);
};

export const fetchSuppliers = async (): Promise<Supplier[]> => {
  const response = await apiClient.get("/suppliers");
  return normalizeListResponse<Supplier>(response.data?.data).map(
    normalizeSupplierRecord,
  );
};

export const createSupplier = async (
  payload: SupplierInput,
): Promise<Supplier> => {
  const response = await apiClient.post(
    "/suppliers",
    normalizeSupplierPayload(payload, true),
  );
  return normalizeSupplierRecord(response.data.data as Supplier);
};

export const updateSupplier = async (
  id: number,
  payload: Partial<SupplierInput>,
): Promise<void> => {
  await apiClient.put(`/suppliers/${id}`, normalizeSupplierPayload(payload));
};

export const deleteSupplier = async (id: number): Promise<void> => {
  await apiClient.delete(`/suppliers/${id}`);
};

export const fetchWorkers = async (): Promise<Worker[]> => {
  const response = await apiClient.get("/workers");
  return response.data.data as Worker[];
};

export const fetchWorkersOverview = async (
  period: "today" | "this_week" | "this_month" = "this_month",
): Promise<WorkerOverviewResponse> => {
  const response = await apiClient.get("/workers/overview", {
    params: { period },
  });
  return response.data.data as WorkerOverviewResponse;
};

export const createWorker = async (payload: WorkerInput): Promise<Worker> => {
  const response = await apiClient.post("/workers/create", payload);
  return response.data.data as Worker;
};

export const updateWorker = async (
  id: string,
  payload: WorkerUpdateInput,
): Promise<Worker> => {
  const response = await apiClient.put(`/workers/${id}`, payload);
  return response.data.data as Worker;
};

export const deleteWorker = async (id: string): Promise<void> => {
  await apiClient.delete(`/workers/${id}`);
};

// Worker Panel API functions
export const fetchWorkerProfile = async (): Promise<WorkerProfileResponse> => {
  const response = await apiClient.get("/worker/profile");
  return response.data.data as WorkerProfileResponse;
};

export const updateWorkerProfile = async (payload: {
  name?: string;
  email?: string;
  phone?: string;
}): Promise<WorkerProfileResponse> => {
  const response = await apiClient.put("/worker/profile", payload);
  return response.data.data as WorkerProfileResponse;
};

export const changeWorkerPassword = async (payload: {
  current_password: string;
  password: string;
  confirm_password: string;
}): Promise<void> => {
  await apiClient.put("/worker/password", payload);
};

export const fetchWorkerDashboardOverview =
  async (): Promise<WorkerDashboardOverviewResponse> => {
    const response = await apiClient.get("/worker/dashboard/overview");
    return response.data.data as WorkerDashboardOverviewResponse;
  };

export const fetchWorkerIncentives =
  async (): Promise<WorkerIncentiveResponse> => {
    const response = await apiClient.get("/worker/dashboard/incentives");
    return response.data.data as WorkerIncentiveResponse;
  };

export const fetchWorkerHistory = async (
  params?: WorkerHistoryParams,
): Promise<WorkerHistoryResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.startDate) searchParams.set("startDate", params.startDate);
  if (params?.endDate) searchParams.set("endDate", params.endDate);
  if (params?.minAmount) searchParams.set("minAmount", params.minAmount);
  if (params?.maxAmount) searchParams.set("maxAmount", params.maxAmount);
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  const response = await apiClient.get(
    query ? `/worker/dashboard/history?${query}` : "/worker/dashboard/history",
  );
  return response.data.data as WorkerHistoryResponse;
};

export const fetchPurchases = async (
  params?: PurchaseListParams,
): Promise<Purchase[]> => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  const response = await apiClient.get(query ? `/purchases?${query}` : "/purchases");
  const payload = response.data?.data;
  return normalizeListResponse<Purchase>(
    payload?.purchases ?? payload?.items ?? payload,
  );
};

export const fetchPurchasesPage = async (
  params?: PurchaseListParams,
): Promise<PurchaseListResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  const response = await apiClient.get(query ? `/purchases?${query}` : "/purchases");
  const payload = response.data?.data;
  const purchases = normalizeListResponse<Purchase>(
    payload?.purchases ?? payload?.items ?? payload,
  );

  return {
    purchases,
    total: typeof payload?.total === "number" ? payload.total : purchases.length,
    page: typeof payload?.page === "number" ? payload.page : (params?.page ?? 1),
    limit:
      typeof payload?.limit === "number"
        ? payload.limit
        : (params?.limit ?? purchases.length),
    totalPages: typeof payload?.totalPages === "number" ? payload.totalPages : 1,
  };
};

export const fetchPurchase = async (id: number): Promise<Purchase> => {
  const response = await apiClient.get(`/purchases/${id}`);
  return response.data.data as Purchase;
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

export const fetchInvoiceBootstrap = async (): Promise<InvoiceBootstrap> => {
  const response = await apiClient.get("/invoices/bootstrap");
  return response.data.data as InvoiceBootstrap;
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

export const updatePayment = async (
  paymentId: number,
  payload: PaymentUpdateInput,
): Promise<void> => {
  await apiClient.put(`/payments/${paymentId}`, payload);
};

export const fetchAccessPaymentStatus =
  async (): Promise<AccessPaymentStatusResponse> => {
    const response = await apiClient.get("/payments/access/status");
    return response.data.data as AccessPaymentStatusResponse;
  };

export const createAccessRazorpayOrder = async (
  payload: CreateAccessRazorpayOrderInput,
): Promise<CreateAccessRazorpayOrderResponse> => {
  const response = await apiClient.post(
    "/payments/access/razorpay/order",
    payload,
  );
  return response.data.data as CreateAccessRazorpayOrderResponse;
};

export const verifyAccessRazorpayPayment = async (
  payload: VerifyAccessRazorpayPaymentInput,
): Promise<AccessPaymentRecord> => {
  const response = await apiClient.post(
    "/payments/access/razorpay/verify",
    payload,
  );
  return response.data.data as AccessPaymentRecord;
};

export const submitAccessUpiPayment = async (
  payload: FormData,
): Promise<AccessPaymentRecord> => {
  const response = await apiClient.post("/submit-upi", payload, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data as AccessPaymentRecord;
};

export const uploadAccessPaymentProof = async (
  payload: UploadAccessPaymentProofInput,
  options?: {
    onUploadProgress?: (progressPercent: number) => void;
  },
): Promise<AccessPaymentRecord> => {
  const formData = new FormData();
  formData.append("plan_id", payload.planId);
  formData.append("billing_cycle", payload.billingCycle);
  if (payload.name?.trim()) {
    formData.append("name", payload.name.trim());
  }
  if (payload.utr?.trim()) {
    formData.append("utr", payload.utr.trim().toUpperCase());
  }
  formData.append("paymentProof", payload.paymentProof);

  const response = await apiClient.post("/payments/upload-proof", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (!options?.onUploadProgress) return;
      if (!event.total || event.total <= 0) return;
      const progressPercent = Math.round((event.loaded / event.total) * 100);
      options.onUploadProgress(progressPercent);
    },
  });

  return response.data.data as AccessPaymentRecord;
};

export const fetchSubscriptionStatus =
  async (): Promise<SubscriptionSnapshot> => {
    const response = await apiClient.get("/subscriptions/me");
    return response.data.data as SubscriptionSnapshot;
  };

export const fetchUserPermissions = async (): Promise<UserPermissions> => {
  const response = await apiClient.get("/subscriptions/permissions");
  return response.data.data as UserPermissions;
};

export const cancelSubscription = async (): Promise<SubscriptionSnapshot> => {
  const response = await apiClient.post("/subscriptions/cancel");
  return response.data.data as SubscriptionSnapshot;
};

export const switchToFreePlan = async (): Promise<SubscriptionSnapshot> => {
  const response = await apiClient.post("/subscriptions/free");
  return response.data.data as SubscriptionSnapshot;
};

export const sendInvoiceEmail = async (
  invoiceId: number,
  payload: { email?: string; preview_payload?: InvoiceRenderPayload } = {},
): Promise<{
  invoiceId: number;
  status?: string;
  email?: string;
  queued?: boolean;
  jobId?: string | null;
}> => {
  const response = await apiClient.post(`/invoices/${invoiceId}/send`, payload);
  return (response.data?.data ?? { invoiceId }) as {
    invoiceId: number;
    status?: string;
    email?: string;
    queued?: boolean;
    jobId?: string | null;
  };
};

export const sendInvoiceReminder = async (
  invoiceId: number,
  payload: { email?: string } = {},
): Promise<{ invoiceId: number; email?: string }> => {
  const response = await apiClient.post(
    `/invoices/${invoiceId}/reminder`,
    payload,
  );
  return (response.data?.data ?? { invoiceId }) as {
    invoiceId: number;
    email?: string;
  };
};

export const fetchPreviewInvoicePdfFile = async (
  previewPayload: InvoiceRenderPayload,
  fallbackFileName?: string,
): Promise<{ blob: Blob; fileName: string }> => {
  const response = await apiClient.post(
    "/invoices/preview-pdf",
    {
      file_name: fallbackFileName,
      preview_payload: previewPayload,
    },
    {
      responseType: "blob",
    },
  );

  const fallback = fallbackFileName?.trim() || "invoice-preview.pdf";
  const disposition = response.headers?.["content-disposition"] as
    | string
    | undefined;

  return {
    blob: response.data as Blob,
    fileName: parseDownloadFileName(disposition, fallback),
  };
};

const parseDownloadFileName = (
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

const extractBlobErrorMessage = async (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const responseData = error.response?.data;

  if (responseData instanceof Blob) {
    try {
      const text = await responseData.text();

      if (!text) {
        return null;
      }

      try {
        const parsed = JSON.parse(text) as { message?: string };
        return parsed.message?.trim() || null;
      } catch {
        return text.trim() || null;
      }
    } catch {
      return null;
    }
  }

  if (responseData instanceof ArrayBuffer) {
    try {
      const text = new TextDecoder().decode(responseData);

      if (!text) {
        return null;
      }

      try {
        const parsed = JSON.parse(text) as { message?: string };
        return parsed.message?.trim() || null;
      } catch {
        return text.trim() || null;
      }
    } catch {
      return null;
    }
  }

  if (
    responseData &&
    typeof responseData === "object" &&
    "message" in responseData &&
    typeof responseData.message === "string"
  ) {
    return responseData.message.trim() || null;
  }

  return null;
};

export const runDataExport = async (
  payload: ExportRequest,
): Promise<ExportResponse> => {
  try {
    const response = await apiClient.post(
      `/exports/${payload.resource}`,
      payload,
      {
        responseType: "arraybuffer",
      },
    );

    const contentType = String(response.headers?.["content-type"] || "");
    const disposition = response.headers?.["content-disposition"] as
      | string
      | undefined;

    if (contentType.includes("application/json")) {
      const text = new TextDecoder().decode(response.data as ArrayBuffer);
      const parsed = JSON.parse(text) as {
        message?: string;
        data?: {
          delivery: "email";
          fileName: string;
          email: string;
          exportedCount: number;
        };
      };

      return {
        delivery: "email",
        fileName:
          parsed.data?.fileName ?? `${payload.resource}.${payload.format}`,
        email: parsed.data?.email ?? payload.email ?? "",
        exportedCount: parsed.data?.exportedCount ?? 0,
        message: parsed.message ?? "Export sent successfully.",
      };
    }

    const fileName = parseDownloadFileName(
      disposition,
      `${payload.resource}.${payload.format}`,
    );

    return {
      delivery: "download",
      blob: new Blob([response.data as ArrayBuffer], { type: contentType }),
      fileName,
    };
  } catch (error) {
    const message =
      (await extractBlobErrorMessage(error)) || "Unable to export data.";
    throw new Error(message);
  }
};

export const previewDataExport = async (
  payload: Pick<
    ExportRequest,
    "resource" | "scope" | "fields" | "selected_ids" | "filters"
  >,
): Promise<ExportPreviewResponse> => {
  try {
    const response = await apiClient.post(
      `/exports/${payload.resource}/preview`,
      payload,
    );

    return response.data.data as ExportPreviewResponse;
  } catch (error) {
    const message =
      (await extractBlobErrorMessage(error)) || "Unable to preview export.";
    throw new Error(message);
  }
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
    fileName: parseDownloadFileName(disposition, fallback),
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

export const fetchInventoryInsights = async (
  warehouseId?: number,
): Promise<InventoryInsightsResponse> => {
  const response = await apiClient.get("/inventories/insights", {
    params: warehouseId ? { warehouseId } : undefined,
  });
  return response.data.data as InventoryInsightsResponse;
};

const buildInventoryPredictionParams = (
  filters?: InventoryDemandPredictionFilters,
) => {
  if (!filters) return undefined;

  const params = new URLSearchParams();

  if (filters.productId) {
    params.set("productId", String(filters.productId));
  }
  if (filters.warehouseId) {
    params.set("warehouseId", String(filters.warehouseId));
  }
  if (filters.categoryId) {
    params.set("categoryId", String(filters.categoryId));
  }
  if (filters.supplierId) {
    params.set("supplierId", String(filters.supplierId));
  }
  if (filters.alertLevel) {
    params.set("alertLevel", filters.alertLevel);
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  filters.productIds?.forEach((productId) => {
    params.append("productIds", String(productId));
  });

  const query = params.toString();
  return query ? query : undefined;
};

export const fetchInventoryDemandPredictions = async (
  filters?: InventoryDemandPredictionFilters,
): Promise<InventoryDemandPredictionsResponse> => {
  const query = buildInventoryPredictionParams(filters);
  const response = await apiClient.get(
    query
      ? `/inventory-demand/predictions?${query}`
      : "/inventory-demand/predictions",
  );
  return response.data.data as InventoryDemandPredictionsResponse;
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
  period: "lifetime" | "month" | "week" | "year" = "lifetime",
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

export const fetchDashboardTransactions = async (
  filters?: DashboardOverviewFilters,
): Promise<DashboardTransactions> => {
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

export const fetchFinancialCopilot = async (params?: {
  language?: "en" | "hi";
  amount?: number;
}): Promise<FinancialCopilotPayload> => {
  const response = await apiClient.get("/copilot/summary", { params });
  return response.data.data as FinancialCopilotPayload;
};

export const fetchFinancialGoals = async (): Promise<FinancialGoalRecord[]> => {
  const response = await apiClient.get("/copilot/goals");
  return response.data.data as FinancialGoalRecord[];
};

export const createFinancialGoal = async (
  payload: FinancialGoalInput,
): Promise<FinancialGoalRecord> => {
  const response = await apiClient.post("/copilot/goals", payload);
  return response.data.data as FinancialGoalRecord;
};

export const updateFinancialGoal = async (
  id: number,
  payload: Partial<FinancialGoalInput>,
): Promise<FinancialGoalRecord> => {
  const response = await apiClient.put(`/copilot/goals/${id}`, payload);
  return response.data.data as FinancialGoalRecord;
};

export const deleteFinancialGoal = async (id: number): Promise<void> => {
  await apiClient.delete(`/copilot/goals/${id}`);
};

export const askAssistant = async (
  message: string,
  history: AssistantHistoryMessage[] = [],
): Promise<AssistantReply> => {
  try {
    const response = await apiClient.post("/assistant/query", {
      message,
      history,
    });
    return response.data.data as AssistantReply;
  } catch (error) {
    const responseMessage =
      axios.isAxiosError(error) &&
      error.response?.data &&
      typeof error.response.data === "object" &&
      "message" in error.response.data &&
      typeof error.response.data.message === "string"
        ? error.response.data.message.trim()
        : "";

    if (responseMessage) {
      throw new Error(responseMessage);
    }

    if (axios.isAxiosError(error) && error.code === "ERR_NETWORK") {
      throw new Error(
        "Network issue while contacting assistant. Please check internet and try again.",
      );
    }

    throw new Error("Assistant request failed. Please try again.");
  }
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

export const fetchUserSettingsPreferences =
  async (): Promise<UserSettingsPreferences> => {
    const response = await apiClient.get("/settings/preferences");
    return response.data.data as UserSettingsPreferences;
  };

export const saveUserSettingsPreferences = async (
  payload: Partial<UserSettingsPreferences>,
): Promise<UserSettingsPreferences> => {
  const response = await apiClient.put("/settings/preferences", payload);
  return response.data.data as UserSettingsPreferences;
};

export const fetchNotifications = async (
  limit = 10,
): Promise<NotificationListResponse> => {
  const response = await apiClient.get("/notifications", {
    params: { limit },
  });
  return response.data.data as NotificationListResponse;
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  await apiClient.post(`/notifications/${id}/read`);
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  await apiClient.post("/notifications/read-all");
};

export const fetchSecurityActivity = async (): Promise<
  SecurityActivityEvent[]
> => {
  const response = await apiClient.get("/security/activity");
  return response.data.data as SecurityActivityEvent[];
};

export const logoutAllDevices = async (): Promise<void> => {
  await apiClient.post("/security/logout-all");
};

export const logoutCurrentSession = async (): Promise<void> => {
  await apiClient.post("/auth/logout");
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
  businessAddress?: Partial<BusinessAddressRecord>;
  address_line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
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

  const normalizedBusinessAddress = toBusinessAddressInput({
    addressLine1:
      payload.businessAddress?.addressLine1 ?? payload.address_line1,
    city: payload.businessAddress?.city ?? payload.city,
    state: payload.businessAddress?.state ?? payload.state,
    pincode: payload.businessAddress?.pincode ?? payload.pincode,
  });

  const hasStructuredBusinessAddress = Boolean(
    normalizedBusinessAddress.addressLine1 ||
    normalizedBusinessAddress.city ||
    normalizedBusinessAddress.state ||
    normalizedBusinessAddress.pincode,
  );

  const legacyAddress = formatBusinessAddress(
    normalizedBusinessAddress,
    payload.address,
  );

  const normalizedPayload = {
    business_name: sanitizeBusinessName(payload.business_name),
    businessAddress: hasStructuredBusinessAddress
      ? {
          addressLine1: sanitizeBusinessAddressLine(
            normalizedBusinessAddress.addressLine1,
          ),
          city: sanitizeBusinessCity(normalizedBusinessAddress.city),
          state: sanitizeBusinessState(normalizedBusinessAddress.state),
          pincode: sanitizeBusinessPincode(normalizedBusinessAddress.pincode),
        }
      : undefined,
    address_line1: hasStructuredBusinessAddress
      ? sanitizeBusinessAddressLine(normalizedBusinessAddress.addressLine1)
      : undefined,
    city: hasStructuredBusinessAddress ? sanitizeBusinessCity(normalizedBusinessAddress.city) : undefined,
    state: hasStructuredBusinessAddress ? sanitizeBusinessState(normalizedBusinessAddress.state) : undefined,
    pincode: hasStructuredBusinessAddress ? sanitizeBusinessPincode(normalizedBusinessAddress.pincode) : undefined,
    address: toOptional(legacyAddress),
    phone: toOptional(sanitizeBusinessPhone(payload.phone)),
    email: toOptional(sanitizeBusinessEmail(payload.email)),
    website: toOptional(sanitizeBusinessWebsite(payload.website)),
    logo_url: toOptional(payload.logo_url),
    tax_id: toOptional(sanitizeBusinessTaxId(payload.tax_id)),
    currency: sanitizeBusinessCurrency(payload.currency) || "INR",
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
export const uploadLogo = async (file: File): Promise<{ logo_url: string }> => {
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
