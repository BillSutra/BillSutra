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
  fetchProducts,
  fetchPurchases,
  fetchSales,
  fetchInvoices,
  fetchInvoice,
  createInvoice,
  deleteInvoice,
  createCategory,
  fetchSuppliers,
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
} from "@/lib/apiClient";

const dashboardQueryKeys = [
  ["dashboard", "overview"],
  ["dashboard", "sales"],
  ["dashboard", "inventory"],
  ["dashboard", "transactions"],
  ["dashboard", "customers"],
  ["dashboard", "suppliers"],
  ["dashboard", "cashflow"],
  ["dashboard", "forecast"],
] as const;

const invalidateDashboardQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
) =>
  Promise.all(
    dashboardQueryKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );

export const useProductsQuery = () =>
  useQuery({ queryKey: ["products"], queryFn: fetchProducts });

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

export const useCustomersQuery = () =>
  useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });

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

export const usePurchasesQuery = () =>
  useQuery({ queryKey: ["purchases"], queryFn: fetchPurchases });

export const useCreatePurchaseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPurchase,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["inventories"] }),
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboardQueries(queryClient),
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
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboardQueries(queryClient),
      ]),
  });
};

export const useSalesQuery = () =>
  useQuery({ queryKey: ["sales"], queryFn: fetchSales });

export const useInvoicesQuery = () =>
  useQuery({ queryKey: ["invoices"], queryFn: fetchInvoices });

export const useInvoiceQuery = (invoiceId?: number) =>
  useQuery({
    queryKey: ["invoices", invoiceId],
    queryFn: () => fetchInvoice(invoiceId ?? 0),
    enabled: Number.isFinite(invoiceId) && (invoiceId ?? 0) > 0,
  });

export const useCreateInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        invalidateDashboardQueries(queryClient),
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
        invalidateDashboardQueries(queryClient),
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
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboardQueries(queryClient),
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
        invalidateDashboardQueries(queryClient),
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
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboardQueries(queryClient),
      ]),
  });
};

export const useWarehousesQuery = () =>
  useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });

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
        queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
        invalidateDashboardQueries(queryClient),
      ]),
  });
};
