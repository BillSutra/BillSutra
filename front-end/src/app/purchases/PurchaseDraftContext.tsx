"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product, Purchase } from "@/lib/apiClient";
import type { PurchaseSuggestionItem } from "@/hooks/usePredictionQueries";

export type PurchaseDraftForm = {
  supplier_id: string;
  warehouse_id: string;
  purchase_date: string;
  payment_status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  amount_paid: string;
  payment_date: string;
  payment_method: string;
  notes: string;
};

export type PurchaseDraftItem = {
  product_id: string;
  product_label: string;
  quantity: string;
  unit_cost: string;
  tax_rate: string;
};

type PurchaseDraftState = {
  form: PurchaseDraftForm;
  items: PurchaseDraftItem[];
  editingId: number | null;
  lastLoadedPurchaseId: number | null;
};

type PurchaseDraftContextValue = {
  state: PurchaseDraftState;
  setFormField: <K extends keyof PurchaseDraftForm>(
    key: K,
    value: PurchaseDraftForm[K],
  ) => void;
  setFormState: (
    updater:
      | Partial<PurchaseDraftForm>
      | ((current: PurchaseDraftForm) => PurchaseDraftForm),
  ) => void;
  replaceItems: (
    updater:
      | PurchaseDraftItem[]
      | ((current: PurchaseDraftItem[]) => PurchaseDraftItem[]),
  ) => void;
  updateItemField: (
    index: number,
    key: keyof PurchaseDraftItem,
    value: string,
  ) => void;
  setProductForItem: (index: number, product: Product | null) => number | null;
  addItem: () => void;
  removeItem: (index: number) => void;
  appendSuggestedItem: (
    suggestion: Pick<
      PurchaseSuggestionItem,
      | "product_id"
      | "product_name"
      | "recommended_reorder_quantity"
      | "unit_cost"
    >,
    taxRate?: number,
  ) => void;
  mergeSuggestedItems: (
    suggestedItems: Array<
      Pick<
        PurchaseSuggestionItem,
        | "product_id"
        | "product_name"
        | "recommended_reorder_quantity"
        | "unit_cost"
      >
    >,
    options?: {
      supplierId?: number | null;
      warehouseId?: number | null;
      note?: string;
    },
  ) => void;
  loadSuggestedItems: (suggestedItems: PurchaseSuggestionItem[]) => void;
  loadPurchase: (purchase: Purchase) => void;
  resetDraft: () => void;
  setEditingId: (value: number | null) => void;
};

const STORAGE_KEY = "billsutra:purchases:draft:v2";

const createEmptyPurchaseItem = (): PurchaseDraftItem => ({
  product_id: "",
  product_label: "",
  quantity: "1",
  unit_cost: "",
  tax_rate: "",
});

const createEmptyPurchaseForm = (): PurchaseDraftForm => ({
  supplier_id: "",
  warehouse_id: "",
  purchase_date: "",
  payment_status: "UNPAID",
  amount_paid: "",
  payment_date: "",
  payment_method: "",
  notes: "",
});

const createEmptyDraftState = (): PurchaseDraftState => ({
  form: createEmptyPurchaseForm(),
  items: [createEmptyPurchaseItem()],
  editingId: null,
  lastLoadedPurchaseId: null,
});

const sanitizeNumericInput = (value: string) => value.replace(/[^\d.]/g, "");

const normalizeDraftItem = (item?: Partial<PurchaseDraftItem> | null): PurchaseDraftItem => ({
  product_id: item?.product_id?.trim() ?? "",
  product_label: item?.product_label?.trim() ?? "",
  quantity: item?.quantity?.trim() || "1",
  unit_cost: item?.unit_cost?.trim() ?? "",
  tax_rate: item?.tax_rate?.trim() ?? "",
});

const mergeDuplicateItems = (items: PurchaseDraftItem[]) => {
  const merged: PurchaseDraftItem[] = [];

  items.forEach((rawItem) => {
    const item = normalizeDraftItem(rawItem);
    if (!item.product_id) {
      merged.push(item);
      return;
    }

    const existingIndex = merged.findIndex(
      (entry) => entry.product_id === item.product_id,
    );

    if (existingIndex < 0) {
      merged.push(item);
      return;
    }

    const existing = merged[existingIndex];
    const combinedQuantity =
      (Number(existing.quantity) || 0) + (Number(item.quantity) || 0);

    merged[existingIndex] = {
      ...existing,
      product_label: item.product_label || existing.product_label,
      quantity: String(Math.max(combinedQuantity, 1)),
      unit_cost: item.unit_cost || existing.unit_cost,
      tax_rate: item.tax_rate || existing.tax_rate,
    };
  });

  return merged.length > 0 ? merged : [createEmptyPurchaseItem()];
};

const normalizeItems = (items: PurchaseDraftItem[]) =>
  mergeDuplicateItems(items.map((item) => normalizeDraftItem(item)));

const toSuggestionDraftItem = (
  suggestion: Pick<
    PurchaseSuggestionItem,
    | "product_id"
    | "product_name"
    | "recommended_reorder_quantity"
    | "unit_cost"
  >,
  taxRate?: number,
): PurchaseDraftItem => ({
  product_id: String(suggestion.product_id),
  product_label: suggestion.product_name,
  quantity: String(suggestion.recommended_reorder_quantity),
  unit_cost: String(suggestion.unit_cost),
  tax_rate: taxRate !== undefined ? String(taxRate) : "",
});

const readStoredDraft = (): PurchaseDraftState => {
  if (typeof window === "undefined") {
    return createEmptyDraftState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyDraftState();
    }

    const parsed = JSON.parse(raw) as Partial<PurchaseDraftState>;
    return {
      form: {
        ...createEmptyPurchaseForm(),
        ...(parsed.form ?? {}),
      },
      items: normalizeItems(Array.isArray(parsed.items) ? parsed.items : []),
      editingId:
        typeof parsed.editingId === "number" && Number.isFinite(parsed.editingId)
          ? parsed.editingId
          : null,
      lastLoadedPurchaseId:
        typeof parsed.lastLoadedPurchaseId === "number" &&
        Number.isFinite(parsed.lastLoadedPurchaseId)
          ? parsed.lastLoadedPurchaseId
          : null,
    };
  } catch {
    return createEmptyDraftState();
  }
};

const PurchaseDraftContext = createContext<PurchaseDraftContextValue | null>(
  null,
);

export function PurchaseDraftProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PurchaseDraftState>(() => readStoredDraft());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setFormField = useCallback(
    <K extends keyof PurchaseDraftForm>(key: K, value: PurchaseDraftForm[K]) => {
      setState((current) => ({
        ...current,
        form: {
          ...current.form,
          [key]: value,
        },
      }));
    },
    [],
  );

  const setFormState = useCallback(
    (
      updater:
        | Partial<PurchaseDraftForm>
        | ((current: PurchaseDraftForm) => PurchaseDraftForm),
    ) => {
      setState((current) => ({
        ...current,
        form:
          typeof updater === "function"
            ? updater(current.form)
            : { ...current.form, ...updater },
      }));
    },
    [],
  );

  const replaceItems = useCallback(
    (
      updater:
        | PurchaseDraftItem[]
        | ((current: PurchaseDraftItem[]) => PurchaseDraftItem[]),
    ) => {
      setState((current) => ({
        ...current,
        items: normalizeItems(
          typeof updater === "function" ? updater(current.items) : updater,
        ),
      }));
    },
    [],
  );

  const updateItemField = useCallback(
    (index: number, key: keyof PurchaseDraftItem, value: string) => {
      setState((current) => ({
        ...current,
        items: normalizeItems(
          current.items.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  [key]:
                    key === "quantity" || key === "unit_cost" || key === "tax_rate"
                      ? sanitizeNumericInput(value)
                      : value,
                }
              : item,
          ),
        ),
      }));
    },
    [],
  );

  const addItem = useCallback(() => {
    setState((current) => ({
      ...current,
      items: [...current.items, createEmptyPurchaseItem()],
    }));
  }, []);

  const removeItem = useCallback((index: number) => {
    setState((current) => ({
      ...current,
      items:
        current.items.length <= 1
          ? [createEmptyPurchaseItem()]
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }, []);

  const setProductForItem = useCallback(
    (index: number, product: Product | null) => {
      let focusIndex: number | null = null;

      setState((current) => {
        if (!product) {
          return {
            ...current,
            items: current.items.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    product_id: "",
                    product_label: "",
                  }
                : item,
            ),
          };
        }

        const duplicateIndex = current.items.findIndex(
          (item, itemIndex) =>
            itemIndex !== index && item.product_id === String(product.id),
        );

        if (duplicateIndex >= 0) {
          const sourceItem = current.items[index];
          const duplicateItem = current.items[duplicateIndex];
          focusIndex = duplicateIndex;
          return {
            ...current,
            items: normalizeItems(
              current.items
                .map((item, itemIndex) =>
                  itemIndex === duplicateIndex
                    ? {
                        ...duplicateItem,
                        quantity: String(
                          Math.max(
                            1,
                            (Number(duplicateItem.quantity) || 0) +
                              Math.max(1, Number(sourceItem.quantity) || 1),
                          ),
                        ),
                        unit_cost:
                          product.cost?.toString() ||
                          product.price?.toString() ||
                          duplicateItem.unit_cost,
                        tax_rate:
                          product.gst_rate !== undefined &&
                          product.gst_rate !== null
                            ? String(product.gst_rate)
                            : duplicateItem.tax_rate,
                      }
                    : item,
                )
                .filter((_, itemIndex) => itemIndex !== index),
            ),
          };
        }

        focusIndex = index;
        return {
          ...current,
          items: current.items.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  product_id: String(product.id),
                  product_label: product.sku
                    ? `${product.name} - ${product.sku}`
                    : product.name,
                  unit_cost:
                    product.cost?.toString() ||
                    product.price?.toString() ||
                    item.unit_cost,
                  tax_rate:
                    product.gst_rate !== undefined && product.gst_rate !== null
                      ? String(product.gst_rate)
                      : item.tax_rate,
                }
              : item,
          ),
        };
      });

      return focusIndex;
    },
    [],
  );

  const appendSuggestedItem = useCallback(
    (
      suggestion: Pick<
        PurchaseSuggestionItem,
        | "product_id"
        | "product_name"
        | "recommended_reorder_quantity"
        | "unit_cost"
      >,
      taxRate?: number,
    ) => {
      const nextItem = toSuggestionDraftItem(suggestion, taxRate);

      setState((current) => {
        const blankIndex = current.items.findIndex((item) => !item.product_id);
        if (blankIndex >= 0) {
          return {
            ...current,
            editingId: null,
            items: normalizeItems(
              current.items.map((item, itemIndex) =>
                itemIndex === blankIndex ? nextItem : item,
              ),
            ),
          };
        }

        return {
          ...current,
          editingId: null,
          items: normalizeItems([...current.items, nextItem]),
        };
      });
    },
    [],
  );

  const mergeSuggestedItems = useCallback(
    (
      suggestedItems: Array<
        Pick<
          PurchaseSuggestionItem,
          | "product_id"
          | "product_name"
          | "recommended_reorder_quantity"
          | "unit_cost"
        >
      >,
      options?: {
        supplierId?: number | null;
        warehouseId?: number | null;
        note?: string;
      },
    ) => {
      if (suggestedItems.length === 0) {
        return;
      }

      setState((current) => {
        const existingItems = current.items.filter((item) => item.product_id);
        const mergedItems = normalizeItems([
          ...existingItems,
          ...suggestedItems.map((item) => toSuggestionDraftItem(item)),
        ]);

        return {
          ...current,
          editingId: null,
          lastLoadedPurchaseId: null,
          form: {
            ...current.form,
            supplier_id:
              options?.supplierId !== undefined && options.supplierId !== null
                ? String(options.supplierId)
                : current.form.supplier_id,
            warehouse_id:
              options?.warehouseId !== undefined && options.warehouseId !== null
                ? String(options.warehouseId)
                : current.form.warehouse_id,
            notes: current.form.notes.trim() || options?.note || current.form.notes,
          },
          items: mergedItems,
        };
      });
    },
    [],
  );

  const loadSuggestedItems = useCallback((suggestedItems: PurchaseSuggestionItem[]) => {
    const firstWarehouseId =
      suggestedItems.find((item) => item.warehouseId)?.warehouseId ?? null;
    const firstSupplierId =
      suggestedItems.find((item) => item.supplierId)?.supplierId ?? null;

    setState((current) => ({
      ...current,
      editingId: null,
      lastLoadedPurchaseId: null,
      form: {
        ...current.form,
        supplier_id: firstSupplierId ? String(firstSupplierId) : current.form.supplier_id,
        warehouse_id: firstWarehouseId
          ? String(firstWarehouseId)
          : current.form.warehouse_id,
        notes:
          current.form.notes.trim() ||
          "Loaded from predictive restock suggestions.",
      },
      items: normalizeItems(
        suggestedItems.map((item) => ({
          product_id: String(item.product_id),
          product_label: item.product_name,
          quantity: String(item.recommended_reorder_quantity),
          unit_cost: String(item.unit_cost),
          tax_rate: "",
        })),
      ),
    }));
  }, []);

  const loadPurchase = useCallback((purchase: Purchase) => {
    setState({
      form: {
        supplier_id: purchase.supplierId
          ? String(purchase.supplierId)
          : purchase.supplier?.id
            ? String(purchase.supplier.id)
            : "",
        warehouse_id: purchase.warehouseId
          ? String(purchase.warehouseId)
          : purchase.warehouse?.id
            ? String(purchase.warehouse.id)
            : "",
        purchase_date: purchase.purchase_date
          ? new Date(purchase.purchase_date).toISOString().slice(0, 10)
          : "",
        payment_status: purchase.paymentStatus ?? "UNPAID",
        amount_paid:
          purchase.paidAmount !== undefined && purchase.paidAmount !== null
            ? String(purchase.paidAmount)
            : "",
        payment_date: purchase.paymentDate
          ? new Date(purchase.paymentDate).toISOString().slice(0, 10)
          : "",
        payment_method: purchase.paymentMethod ?? "",
        notes: purchase.notes ?? "",
      },
      items: normalizeItems(
        purchase.items.map((item) => ({
          product_id: item.productId
            ? String(item.productId)
            : item.product_id
              ? String(item.product_id)
              : "",
          product_label: item.name,
          quantity: String(item.quantity),
          unit_cost: String(item.costPrice ?? item.unit_cost ?? ""),
          tax_rate: item.tax_rate ? String(item.tax_rate) : "",
        })),
      ),
      editingId: purchase.id,
      lastLoadedPurchaseId: purchase.id,
    });
  }, []);

  const resetDraft = useCallback(() => {
    setState(createEmptyDraftState());
  }, []);

  const setEditingId = useCallback((value: number | null) => {
    setState((current) => ({
      ...current,
      editingId: value,
    }));
  }, []);

  const value = useMemo<PurchaseDraftContextValue>(
    () => ({
      state,
      setFormField,
      setFormState,
      replaceItems,
      updateItemField,
      setProductForItem,
      addItem,
      removeItem,
      appendSuggestedItem,
      mergeSuggestedItems,
      loadSuggestedItems,
      loadPurchase,
      resetDraft,
      setEditingId,
    }),
    [
      addItem,
      appendSuggestedItem,
      mergeSuggestedItems,
      loadPurchase,
      loadSuggestedItems,
      removeItem,
      replaceItems,
      resetDraft,
      setEditingId,
      setFormField,
      setFormState,
      setProductForItem,
      state,
      updateItemField,
    ],
  );

  return (
    <PurchaseDraftContext.Provider value={value}>
      {children}
    </PurchaseDraftContext.Provider>
  );
}

export const usePurchaseDraft = () => {
  const context = useContext(PurchaseDraftContext);
  if (!context) {
    throw new Error("usePurchaseDraft must be used inside PurchaseDraftProvider");
  }

  return context;
};

export { createEmptyPurchaseItem };
