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
  fetchPayments,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  createPayment,
  deletePayment,
  updatePayment,
  createCategory,
  deleteCategory,
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
  updateCategory,
  updateCustomer,
  createWorker,
  deleteWorker,
  type Category,
  type CustomerListParams,
  type Invoice,
  type PurchaseListParams,
  type Product,
  type ProductListParams,
  type ProductListResponse,
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

type ProductCollectionCache =
  | Product[]
  | (ProductListResponse & { items?: Product[] });

const isProductListResponse = (
  value: ProductCollectionCache,
): value is ProductListResponse & { items?: Product[] } =>
  !Array.isArray(value) && Array.isArray(value.products);

const updateProductCollection = (
  current: ProductCollectionCache | undefined,
  updater: (products: Product[]) => Product[],
) => {
  if (!current) return current;

  if (Array.isArray(current)) {
    return updater(current);
  }

  if (isProductListResponse(current)) {
    const products = updater(current.products);
    return {
      ...current,
      products,
      ...(Array.isArray(current.items)
        ? { items: updater(current.items) }
        : {}),
    };
  }

  return current;
};

const patchProductCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (products: Product[]) => Product[],
) => {
  queryClient.setQueriesData<ProductCollectionCache>(
    { queryKey: ["products"] },
    (current) => updateProductCollection(current, updater),
  );
};

const replaceProductInCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  product: Product,
) => {
  patchProductCaches(queryClient, (products) =>
    products.map((entry) => (entry.id === product.id ? product : entry)),
  );
};

const productMatchesSearch = (
  product: Product,
  search: string | null | undefined,
) => {
  const normalizedSearch = normalizeSearchTerm(search)?.toLowerCase();
  if (!normalizedSearch) return true;

  return [
    product.name,
    product.sku,
    product.barcode ?? "",
    product.category?.name ?? "",
  ].some((value) => value.toLowerCase().includes(normalizedSearch));
};

const productMatchesCategory = (
  product: Product,
  category: string | null | undefined,
) => {
  if (!category) return true;
  return (
    String(product.category?.id ?? "") === category ||
    (product.category?.name ?? "").toLowerCase() === category.toLowerCase()
  );
};

const upsertProduct = (products: Product[], product: Product) => {
  const existingIndex = products.findIndex((entry) => entry.id === product.id);
  if (existingIndex >= 0) {
    return products.map((entry) => (entry.id === product.id ? product : entry));
  }
  return [product, ...products];
};

const upsertCreatedProductInMatchingCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  product: Product,
) => {
  queryClient
    .getQueriesData<ProductCollectionCache>({ queryKey: ["products"] })
    .forEach(([queryKey, current]) => {
      if (!current) return;

      const scope = queryKey[1];
      const params =
        typeof queryKey[2] === "object" && queryKey[2] !== null
          ? (queryKey[2] as ProductListParams)
          : undefined;
      const search =
        scope === "search" && typeof queryKey[2] === "string"
          ? queryKey[2]
          : params?.search;
      const searchOptions =
        scope === "search" &&
        typeof queryKey[3] === "object" &&
        queryKey[3] !== null
          ? (queryKey[3] as { category?: string | null; limit?: number })
          : undefined;
      const category = searchOptions?.category ?? params?.category;

      if (
        !productMatchesCategory(product, category) ||
        !productMatchesSearch(product, search)
      ) {
        return;
      }

      const isLaterPage =
        isProductListResponse(current) && (params?.page ?? 1) > 1;
      const alreadyCached = Array.isArray(current)
        ? current.some((entry) => entry.id === product.id)
        : current.products.some((entry) => entry.id === product.id);
      if (isLaterPage && !alreadyCached) {
        return;
      }

      queryClient.setQueryData<ProductCollectionCache>(queryKey, (cached) =>
        updateProductCollection(cached, (products) =>
          upsertProduct(products, product).slice(
            0,
            params?.limit ?? searchOptions?.limit ?? products.length + 1,
          ),
        ),
      );
    });
};

const patchCategoryInProductCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  categoryId: number,
  category: Category | null,
) => {
  patchProductCaches(queryClient, (products) =>
    products.map((product) =>
      product.category?.id === categoryId
        ? { ...product, category }
        : product,
    ),
  );
};

const syncCategoryCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (categories: Category[]) => Category[],
) => {
  queryClient.setQueryData<Category[]>(["categories"], (current) =>
    updater(current ?? []),
  );
};

const upsertCategory = (
  categories: Category[],
  category: Category,
  fallbackId?: number,
) => {
  const withoutDuplicate = categories.filter(
    (entry) => entry.id !== category.id && entry.id !== fallbackId,
  );
  return [category, ...withoutDuplicate];
};

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
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["categories"] });
      const previousCategories =
        queryClient.getQueryData<Category[]>(["categories"]);
      const optimisticCategory: Category = {
        id: -Date.now(),
        name: payload.name.trim(),
      };

      syncCategoryCache(queryClient, (categories) =>
        upsertCategory(categories, optimisticCategory),
      );

      return { previousCategories, optimisticCategoryId: optimisticCategory.id };
    },
    onSuccess: (category, _payload, context) => {
      syncCategoryCache(queryClient, (categories) =>
        upsertCategory(categories, category, context?.optimisticCategoryId),
      );
    },
    onError: (_error, _payload, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories"], context.previousCategories);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
};

export const useUpdateCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof updateCategory>[1];
    }) => updateCategory(id, payload),
    onMutate: async ({ id, payload }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["categories"] }),
        queryClient.cancelQueries({ queryKey: ["products"] }),
      ]);

      const previousCategories =
        queryClient.getQueryData<Category[]>(["categories"]);
      const previousProducts =
        queryClient.getQueriesData<ProductCollectionCache>({
          queryKey: ["products"],
        });
      const optimisticCategory = { id, name: payload.name.trim() };

      syncCategoryCache(queryClient, (categories) =>
        categories.map((category) =>
          category.id === id ? optimisticCategory : category,
        ),
      );
      patchCategoryInProductCaches(queryClient, id, optimisticCategory);

      return { previousCategories, previousProducts };
    },
    onSuccess: (category) => {
      syncCategoryCache(queryClient, (categories) =>
        categories.map((entry) => (entry.id === category.id ? category : entry)),
      );
      patchCategoryInProductCaches(queryClient, category.id, category);
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories"], context.previousCategories);
      }
      context?.previousProducts?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]),
  });
};

export const useDeleteCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onMutate: async (id) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["categories"] }),
        queryClient.cancelQueries({ queryKey: ["products"] }),
      ]);

      const previousCategories =
        queryClient.getQueryData<Category[]>(["categories"]);
      const previousProducts =
        queryClient.getQueriesData<ProductCollectionCache>({
          queryKey: ["products"],
        });

      syncCategoryCache(queryClient, (categories) =>
        categories.filter((category) => category.id !== id),
      );
      patchCategoryInProductCaches(queryClient, id, null);

      return { previousCategories, previousProducts };
    },
    onError: (_error, _id, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories"], context.previousCategories);
      }
      context?.previousProducts?.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]),
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
    onSuccess: (product) => {
      upsertCreatedProductInMatchingCaches(queryClient, product);
      return queryClient.invalidateQueries({ queryKey: ["products"] });
    },
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
    onSuccess: (product) => {
      replaceProductInCaches(queryClient, product);
      return queryClient.invalidateQueries({ queryKey: ["products"] });
    },
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

export const usePaymentsQuery = () =>
  useQuery({
    queryKey: ["payments"],
    queryFn: ({ signal }) => fetchPayments({ signal }),
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

export const useDeletePaymentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePayment,
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
