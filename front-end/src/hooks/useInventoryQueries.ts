"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
  updatePayment,
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
  type Invoice,
  type PurchaseListParams,
  type ProductListParams,
  type Worker,
  type WorkerInput,
  type WorkerOverviewResponse,
  type WorkerUpdateInput,
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

const SEARCH_QUERY_STALE_MS = 2 * 60_000;
const CATEGORY_QUERY_OPTIONS = {
  staleTime: 15 * 60_000,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

const normalizeSearchTerm = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const normalizeProductListParams = (params?: ProductListParams) => ({
  page: params?.page ?? 1,
  limit: params?.limit,
  category: params?.category ?? null,
  search: normalizeSearchTerm(params?.search),
  mode: params?.mode ?? "full",
});

const normalizeCustomerListParams = (params?: CustomerListParams) => ({
  page: params?.page ?? 1,
  limit: params?.limit,
  search: normalizeSearchTerm(params?.search),
});

const updateWorkersCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (workers: Worker[]) => Worker[],
) => {
  queryClient.setQueryData<Worker[]>(["workers"], (current) =>
    current ? updater(current) : current,
  );
  queryClient.setQueriesData<WorkerOverviewResponse>(
    { queryKey: ["workers", "overview"] },
    (current) =>
      current
        ? {
            ...current,
            workers: updater(current.workers),
          }
        : current,
  );
};

const buildOptimisticWorker = (payload: WorkerInput): Worker => ({
  id: `temp-worker-${Date.now()}`,
  name: payload.name,
  email: payload.email,
  phone: payload.phone,
  role: payload.accessRole === "ADMIN" ? "ADMIN" : "WORKER",
  businessId: "pending",
  createdAt: new Date().toISOString(),
  roleLabel: payload.accessRole ?? "STAFF",
  status: payload.status ?? "ACTIVE",
  joiningDate: payload.joiningDate ?? null,
  incentiveType: payload.incentiveType ?? "NONE",
  incentiveValue: payload.incentiveValue ?? 0,
  metrics: {
    totalSales: 0,
    totalInvoices: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    incentiveEarned: 0,
    thisMonthSales: 0,
  },
});

const patchWorker = (
  worker: Worker,
  payload: WorkerUpdateInput,
): Worker => ({
  ...worker,
  ...(payload.name !== undefined ? { name: payload.name } : {}),
  ...(payload.email !== undefined ? { email: payload.email } : {}),
  ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
  ...(payload.accessRole !== undefined ? { roleLabel: payload.accessRole } : {}),
  ...(payload.status !== undefined ? { status: payload.status } : {}),
  ...(payload.joiningDate !== undefined
    ? { joiningDate: payload.joiningDate || null }
    : {}),
  ...(payload.incentiveType !== undefined
    ? { incentiveType: payload.incentiveType }
    : {}),
  ...(payload.incentiveValue !== undefined
    ? { incentiveValue: payload.incentiveValue }
    : {}),
});

const patchInvoiceRecord = (
  invoice: Invoice,
  payload: Parameters<typeof updateInvoice>[1],
): Invoice => ({
  ...invoice,
  ...(payload.status !== undefined
    ? {
        status: payload.status,
        computedStatus:
          payload.status === "PAID"
            ? "PAID"
            : payload.status === "PARTIALLY_PAID"
              ? "PARTIAL"
              : payload.status === "SENT"
                ? "UNPAID"
                : invoice.computedStatus,
      }
    : {}),
  ...(payload.notes !== undefined ? { notes: payload.notes ?? null } : {}),
  ...(payload.due_date !== undefined
    ? { due_date: payload.due_date ? String(payload.due_date) : null }
    : {}),
});

export const useProductsQuery = (
  params?: ProductListParams,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: ["products", "options", normalizeProductListParams(params)],
    queryFn: ({ signal }) => fetchProductOptions(params, { signal }),
    enabled: options?.enabled ?? true,
    ...defaultListQueryOptions,
    placeholderData: keepPreviousData,
  });

export const useProductsPageQuery = (params: ProductListParams) =>
  useQuery({
    queryKey: ["products", "page", normalizeProductListParams(params)],
    queryFn: ({ signal }) => fetchProducts(params, { signal }),
    placeholderData: keepPreviousData,
    ...defaultListQueryOptions,
  });

export const useProductSearchQuery = (
  search: string,
  options?: { limit?: number; category?: string | null },
) =>
  useQuery({
    queryKey: ["products", "search", normalizeSearchTerm(search), options],
    queryFn: ({ signal }) =>
      fetchProductOptions({
        page: 1,
        limit: options?.limit ?? 20,
        category: options?.category ?? null,
        search,
      }, { signal }),
    enabled: Boolean(normalizeSearchTerm(search)),
    placeholderData: keepPreviousData,
    staleTime: SEARCH_QUERY_STALE_MS,
    refetchOnWindowFocus: false,
    retry: 0,
  });

export const useCategoriesQuery = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    ...CATEGORY_QUERY_OPTIONS,
  });

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
    queryKey: ["customers", normalizeCustomerListParams(params)],
    queryFn: ({ signal }) => fetchCustomers(params, { signal }),
    placeholderData: keepPreviousData,
    ...defaultListQueryOptions,
  });

export const useCustomerSearchQuery = (
  search: string,
  options?: { limit?: number },
) =>
  useQuery({
    queryKey: ["customers", "search", normalizeSearchTerm(search), options],
    queryFn: ({ signal }) =>
      fetchCustomers({
        page: 1,
        limit: options?.limit ?? 8,
        search,
      }, { signal }),
    enabled: Boolean(normalizeSearchTerm(search)),
    placeholderData: keepPreviousData,
    staleTime: SEARCH_QUERY_STALE_MS,
    refetchOnWindowFocus: false,
    retry: 0,
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
  useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
    ...defaultListQueryOptions,
  });

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

export const useWorkersQuery = (enabled = true) =>
  useQuery({
    queryKey: ["workers"],
    queryFn: fetchWorkers,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

export const useWorkersOverviewQuery = (
  period: "today" | "this_week" | "this_month",
  enabled = true,
) =>
  useQuery({
    queryKey: ["workers", "overview", period],
    queryFn: () => fetchWorkersOverview(period),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

export const useCreateWorkerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorker,
    onMutate: async (payload) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["workers"] }),
        queryClient.cancelQueries({ queryKey: ["workers", "overview"] }),
      ]);

      const previousWorkers = queryClient.getQueryData<Worker[]>(["workers"]);
      const previousOverviews =
        queryClient.getQueriesData<WorkerOverviewResponse>({
          queryKey: ["workers", "overview"],
        });
      const optimisticWorker = buildOptimisticWorker(payload);

      updateWorkersCache(queryClient, (workers) => [optimisticWorker, ...workers]);

      return { previousWorkers, previousOverviews, optimisticWorkerId: optimisticWorker.id };
    },
    onSuccess: (worker, _payload, context) => {
      updateWorkersCache(queryClient, (workers) =>
        workers.map((entry) =>
          entry.id === context?.optimisticWorkerId ? worker : entry,
        ),
      );
    },
    onError: (_error, _payload, context) => {
      if (context?.previousWorkers) {
        queryClient.setQueryData(["workers"], context.previousWorkers);
      }
      context?.previousOverviews?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () =>
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
    onMutate: async (id) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["workers"] }),
        queryClient.cancelQueries({ queryKey: ["workers", "overview"] }),
      ]);

      const previousWorkers = queryClient.getQueryData<Worker[]>(["workers"]);
      const previousOverviews =
        queryClient.getQueriesData<WorkerOverviewResponse>({
          queryKey: ["workers", "overview"],
        });

      updateWorkersCache(queryClient, (workers) =>
        workers.filter((worker) => worker.id !== id),
      );

      return { previousWorkers, previousOverviews };
    },
    onError: (_error, _id, context) => {
      if (context?.previousWorkers) {
        queryClient.setQueryData(["workers"], context.previousWorkers);
      }
      context?.previousOverviews?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () =>
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
    onMutate: async ({ id, payload }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["workers"] }),
        queryClient.cancelQueries({ queryKey: ["workers", "overview"] }),
      ]);

      const previousWorkers = queryClient.getQueryData<Worker[]>(["workers"]);
      const previousOverviews =
        queryClient.getQueriesData<WorkerOverviewResponse>({
          queryKey: ["workers", "overview"],
        });

      updateWorkersCache(queryClient, (workers) =>
        workers.map((worker) =>
          worker.id === id ? patchWorker(worker, payload) : worker,
        ),
      );

      return { previousWorkers, previousOverviews };
    },
    onSuccess: (worker) => {
      updateWorkersCache(queryClient, (workers) =>
        workers.map((entry) => (entry.id === worker.id ? worker : entry)),
      );
    },
    onError: (_error, _variables, context) => {
      if (context?.previousWorkers) {
        queryClient.setQueryData(["workers"], context.previousWorkers);
      }
      context?.previousOverviews?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workers"] }),
        queryClient.invalidateQueries({ queryKey: ["workers", "overview"] }),
      ]),
  });
};

export const usePurchasesQuery = () =>
  useQuery({
    queryKey: ["purchases"],
    queryFn: () => fetchPurchases(),
    ...defaultListQueryOptions,
  });

export const usePurchasesPageQuery = (params: PurchaseListParams) =>
  useQuery({
    queryKey: ["purchases", "page", params],
    queryFn: () => fetchPurchasesPage(params),
    placeholderData: keepPreviousData,
    ...defaultListQueryOptions,
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
  useQuery({
    queryKey: ["sales"],
    queryFn: fetchSales,
    ...defaultListQueryOptions,
  });

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
    onMutate: async ({ id, payload }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["invoices"] }),
        queryClient.cancelQueries({ queryKey: ["invoices", id] }),
      ]);

      const previousInvoices = queryClient.getQueryData<Invoice[]>(["invoices"]);
      const previousInvoice = queryClient.getQueryData<Invoice>(["invoices", id]);

      queryClient.setQueryData<Invoice[]>(["invoices"], (current) =>
        current?.map((invoice) =>
          invoice.id === id ? patchInvoiceRecord(invoice, payload) : invoice,
        ) ?? current,
      );
      queryClient.setQueryData<Invoice>(["invoices", id], (current) =>
        current ? patchInvoiceRecord(current, payload) : current,
      );

      return { previousInvoices, previousInvoice };
    },
    onError: (_error, variables, context) => {
      if (context?.previousInvoices) {
        queryClient.setQueryData(["invoices"], context.previousInvoices);
      }
      if (context?.previousInvoice) {
        queryClient.setQueryData(["invoices", variables.id], context.previousInvoice);
      }
    },
    onSettled: () =>
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

export const useUpdatePaymentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof updatePayment>[1];
    }) => updatePayment(id, payload),
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
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-ledger"] }),
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
