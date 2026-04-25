"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPurchase,
  updatePurchase,
  createSale,
  createSupplier,
  deleteSupplier,
  createProduct,
  deleteProduct,
  createCustomer,
  deleteCustomer,
  fetchCategories,
  fetchCustomers,
  fetchCustomerLedger,
  fetchProductOptions,
  fetchProducts,
  fetchPurchases,
  fetchPurchase,
  fetchPurchasesPage,
  fetchSales,
  fetchInvoices,
  fetchInvoice,
  fetchInvoiceBootstrap,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  createPayment,
  createCategory,
  fetchSuppliers,
  fetchWorkers,
  fetchWorkersOverview,
  fetchWarehouse,
  fetchWarehouses,
  fetchInventories,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  adjustInventory,
  updateSale,
  deleteSale,
  updateSupplier,
  updateProduct,
  updateCustomer,
  createWorker,
  deleteWorker,
  type CustomerListParams,
  type PurchaseListParams,
  type ProductListParams,
  updateWorker,
} from "@/lib/apiClient";
import { invalidateDashboardQueries } from "@/lib/dashboardRealtime";

const invalidateDashboard = (queryClient: ReturnType<typeof useQueryClient>) =>
  invalidateDashboardQueries(queryClient);

const defaultListQueryOptions = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

export const useProductsQuery = (params?: ProductListParams) =>
  useQuery({
    queryKey: ["products", "options", params],
    queryFn: () => fetchProductOptions(params),
    ...defaultListQueryOptions,
  });

export const useProductsPageQuery = (params: ProductListParams) =>
  useQuery({
    queryKey: ["products", "page", params],
    queryFn: () => fetchProducts(params),
    placeholderData: (previousData) => previousData,
  });

export const useProductSearchQuery = (
  search: string,
  options?: { limit?: number; category?: string | null },
) =>
  useQuery({
    queryKey: ["products", "search", search, options],
    queryFn: () =>
      fetchProductOptions({
        page: 1,
        limit: options?.limit ?? 20,
        category: options?.category ?? null,
        search,
      }),
    enabled: search.trim().length > 0,
    placeholderData: (previousData) => previousData,
  });

export const useCategoriesQuery = () =>
  useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

export const useCreateCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
};

export const useCustomersQuery = (params?: CustomerListParams) =>
  useQuery({
    queryKey: ["customers", params],
    queryFn: () => fetchCustomers(params),
    ...defaultListQueryOptions,
  });

export const useCustomerSearchQuery = (
  search: string,
  options?: { limit?: number },
) =>
  useQuery({
    queryKey: ["customers", "search", search, options],
    queryFn: () =>
      fetchCustomers({
        page: 1,
        limit: options?.limit ?? 8,
        search,
      }),
    enabled: search.trim().length > 0,
    placeholderData: (previousData) => previousData,
    ...defaultListQueryOptions,
  });

export const useCustomerLedgerQuery = (customerId?: number) =>
  useQuery({
    queryKey: ["customer-ledger", customerId],
    queryFn: () => fetchCustomerLedger(customerId ?? 0),
    enabled: Number.isFinite(customerId) && (customerId ?? 0) > 0,
  });

export const useCreateCustomerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const useCreateProductMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useUpdateProductMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Record<string, unknown>;
    }) => updateProduct(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useDeleteProductMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useUpdateCustomerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Record<string, unknown>;
    }) => updateCustomer(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const useDeleteCustomerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const useSuppliersQuery = () =>
  useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });

export const useCreateSupplierMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSupplier,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });
};

export const useUpdateSupplierMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Record<string, unknown>;
    }) => updateSupplier(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });
};

export const useDeleteSupplierMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });
};

export const useWorkersQuery = () =>
  useQuery({ queryKey: ["workers"], queryFn: fetchWorkers });

export const useWorkersOverviewQuery = (
  period: "today" | "this_week" | "this_month",
) =>
  useQuery({
    queryKey: ["workers", "overview", period],
    queryFn: () => fetchWorkersOverview(period),
  });

export const useCreateWorkerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorker,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workers"] }),
        queryClient.invalidateQueries({ queryKey: ["workers", "overview"] }),
      ]),
  });
};

export const useDeleteWorkerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorker,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workers"] }),
        queryClient.invalidateQueries({ queryKey: ["workers", "overview"] }),
      ]),
  });
};

export const useUpdateWorkerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateWorker>[1];
    }) => updateWorker(id, payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workers"] }),
        queryClient.invalidateQueries({ queryKey: ["workers", "overview"] }),
      ]),
  });
};

export const usePurchasesQuery = () =>
  useQuery({ queryKey: ["purchases"], queryFn: () => fetchPurchases() });

export const usePurchasesPageQuery = (params: PurchaseListParams) =>
  useQuery({
    queryKey: ["purchases", "page", params],
    queryFn: () => fetchPurchasesPage(params),
    placeholderData: (previousData) => previousData,
  });

export const usePurchaseQuery = (purchaseId?: number) =>
  useQuery({
    queryKey: ["purchases", purchaseId],
    queryFn: () => fetchPurchase(purchaseId ?? 0),
    enabled: Number.isFinite(purchaseId) && (purchaseId ?? 0) > 0,
  });

export const useCreatePurchaseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPurchase,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["inventories"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", "insights"] }),
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboard(queryClient),
      ]),
  });
};

export const useUpdatePurchaseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof updatePurchase>[1];
    }) => updatePurchase(id, payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["inventories"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", "insights"] }),
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboard(queryClient),
      ]),
  });
};

export const useSalesQuery = () =>
  useQuery({ queryKey: ["sales"], queryFn: fetchSales });

export const useInvoicesQuery = () =>
  useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
    ...defaultListQueryOptions,
  });

export const useInvoiceQuery = (invoiceId?: number) =>
  useQuery({
    queryKey: ["invoices", invoiceId],
    queryFn: () => fetchInvoice(invoiceId ?? 0),
    enabled: Number.isFinite(invoiceId) && (invoiceId ?? 0) > 0,
  });

export const useInvoiceBootstrapQuery = () =>
  useQuery({
    queryKey: ["invoices", "bootstrap"],
    queryFn: fetchInvoiceBootstrap,
    ...defaultListQueryOptions,
  });

export const useCreateInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["inventories"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", "insights"] }),
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboard(queryClient),
      ]),
  });
};

export const useDeleteInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-ledger"] }),
        invalidateDashboard(queryClient),
      ]),
  });
};

export const useUpdateInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof updateInvoice>[1];
    }) => updateInvoice(id, payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-ledger"] }),
        invalidateDashboard(queryClient),
      ]),
  });
};

export const useCreatePaymentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPayment,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        invalidateDashboard(queryClient),
      ]),
  });
};

export const useCreateSaleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSale,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["inventories"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", "insights"] }),
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboard(queryClient),
      ]),
  });
};

export const useUpdateSaleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Record<string, unknown>;
    }) => updateSale(id, payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", "insights"] }),
        invalidateDashboard(queryClient),
      ]),
  });
};

export const useDeleteSaleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSale,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["inventories"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", "insights"] }),
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboard(queryClient),
      ]),
  });
};

export const useWarehousesQuery = () =>
  useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
    ...defaultListQueryOptions,
  });

export const useCreateWarehouseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWarehouse,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  });
};

export const useUpdateWarehouseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Record<string, unknown>;
    }) => updateWarehouse(id, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  });
};

export const useDeleteWarehouseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWarehouse,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  });
};

export const useWarehouseQuery = (warehouseId: number) =>
  useQuery({
    queryKey: ["warehouses", warehouseId],
    queryFn: () => fetchWarehouse(warehouseId),
    enabled: Number.isFinite(warehouseId),
  });

export const useInventoriesQuery = (warehouseId?: number) =>
  useQuery({
    queryKey: ["inventories", warehouseId ?? "all"],
    queryFn: () => fetchInventories(warehouseId),
    enabled:
      warehouseId === undefined ||
      (Number.isFinite(warehouseId) && (warehouseId ?? 0) > 0),
  });

export const useAdjustInventoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adjustInventory,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventories"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", "insights"] }),
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboard(queryClient),
      ]),
  });
};
