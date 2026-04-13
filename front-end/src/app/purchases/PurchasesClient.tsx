"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import AsyncProductSelect from "@/components/products/AsyncProductSelect";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ValidationField } from "@/components/ui/ValidationField";
import {
  translateValidationMessage,
  validateName,
  validateEmail,
  validatePhone,
  validateRequired,
  validateNumber,
  validateDate,
} from "@/lib/validation";
import { Label } from "@/components/ui/label";
import {
  useCreatePurchaseMutation,
  useCreateSupplierMutation,
  usePurchasesQuery,
  useSuppliersQuery,
  useUpdatePurchaseMutation,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";
import type { Product } from "@/lib/apiClient";
import SuggestedPurchasesPanel from "@/components/purchases/suggested-purchases-panel";
import SmartSupplierSelect, {
  type SupplierInsight,
} from "@/components/purchases/SmartSupplierSelect";
import { useI18n } from "@/providers/LanguageProvider";
import type { PurchaseSuggestionItem } from "@/hooks/usePredictionQueries";
import { captureAnalyticsEvent } from "@/lib/observability/client";
import { cn } from "@/lib/utils";

const humanizeEnum = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

type PurchasesClientProps = {
  name: string;
  image?: string;
};

type PurchaseLineItemError = {
  product_id?: string;
  quantity?: string;
  unit_cost?: string;
  tax_rate?: string;
};

type PurchaseFormItem = {
  product_id: string;
  product_label: string;
  quantity: string;
  unit_cost: string;
  tax_rate: string;
};

const createEmptyPurchaseItem = (): PurchaseFormItem => ({
  product_id: "",
  product_label: "",
  quantity: "1",
  unit_cost: "",
  tax_rate: "",
});

const COMPACT_MODE_STORAGE_KEY = "billsutra:purchases:compact-mode";

const PurchasesClient = ({ name, image }: PurchasesClientProps) => {
  const { t, formatCurrency, formatDate } = useI18n();
  const searchParams = useSearchParams();
  const { data, isLoading, isError } = usePurchasesQuery();
  const { data: suppliers } = useSuppliersQuery();
  const { data: warehouses } = useWarehousesQuery();
  const createPurchase = useCreatePurchaseMutation();
  const updatePurchase = useUpdatePurchaseMutation();
  const createSupplier = useCreateSupplierMutation();
  const [form, setForm] = useState({
    supplier_id: "",
    warehouse_id: "",
    purchase_date: "",
    payment_status: "UNPAID",
    amount_paid: "",
    payment_date: "",
    payment_method: "",
    notes: "",
  });
  const [items, setItems] = useState<PurchaseFormItem[]>([
    createEmptyPurchaseItem(),
  ]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [lineItemErrors, setLineItemErrors] = useState<PurchaseLineItemError[]>(
    [],
  );
  const [lineItemSummary, setLineItemSummary] = useState<string[]>([]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [hasAppliedSearchPrefill, setHasAppliedSearchPrefill] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return window.localStorage.getItem(COMPACT_MODE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const quantityInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const unitCostInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const taxRateInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const withTranslatedValidation =
    (validator: (value: string) => string) => (value: string) =>
      translateValidationMessage(t, validator(value));

  const formatPurchaseDate = (value: string) =>
    formatDate(new Date(value), { dateStyle: "medium" });

  const formatAmount = (value: string | number) =>
    formatCurrency(Number(value || 0), "INR");

  const translatePaymentStatus = (status: string) => {
    const key = `dashboard.enums.paymentStatus.${status}`;
    const translated = t(key);
    return translated === key ? humanizeEnum(status) : translated;
  };

  const translatePaymentMethod = (value: string) => {
    const key = `dashboard.enums.paymentMethod.${value}`;
    const translated = t(key);
    return translated === key ? humanizeEnum(value) : translated;
  };

  const paymentStatusBadgeClass = (status: string) => {
    if (status === "PAID") return "bg-emerald-100 text-emerald-700";
    if (status === "PARTIALLY_PAID") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  };

  const purchases = useMemo(() => data ?? [], [data]);
  const supplierList = useMemo(() => suppliers ?? [], [suppliers]);
  const warehouseList = useMemo(() => warehouses ?? [], [warehouses]);

  const supplierInsights = useMemo<SupplierInsight[]>(() => {
    const stats = new Map<
      number,
      { usageCount: number; lastPurchaseDate?: string }
    >();

    purchases.forEach((purchase) => {
      const supplierId = purchase.supplier?.id;
      if (!supplierId) return;

      const current = stats.get(supplierId) ?? { usageCount: 0 };
      const purchaseDate = purchase.purchase_date;

      stats.set(supplierId, {
        usageCount: current.usageCount + 1,
        lastPurchaseDate:
          !current.lastPurchaseDate ||
          new Date(purchaseDate) > new Date(current.lastPurchaseDate)
            ? purchaseDate
            : current.lastPurchaseDate,
      });
    });

    return supplierList.map((supplier) => {
      const stat = stats.get(supplier.id);
      const categories = supplier.categories ?? [];
      const outstanding = Number(
        supplier.outstandingBalance ?? supplier.outstanding_balance ?? 0,
      );

      return {
        supplier,
        categories,
        usageCount: stat?.usageCount ?? 0,
        lastPurchaseDate: stat?.lastPurchaseDate,
        outstandingBalance: Number.isFinite(outstanding) ? outstanding : 0,
        isFrequent: (stat?.usageCount ?? 0) >= 3,
      };
    });
  }, [purchases, supplierList]);

  const selectedSupplierId = form.supplier_id ? Number(form.supplier_id) : null;

  const supplierPurchaseHistory = useMemo(
    () =>
      selectedSupplierId
        ? purchases.filter(
            (purchase) => purchase.supplier?.id === selectedSupplierId,
          )
        : [],
    [purchases, selectedSupplierId],
  );

  const suggestedProductsForSupplier = useMemo(() => {
    const map = new Map<
      number,
      {
        product_id: number;
        name: string;
        unit_cost: number;
        tax_rate?: number;
        lastDate?: string;
        count: number;
      }
    >();

    supplierPurchaseHistory.forEach((purchase) => {
      purchase.items.forEach((item) => {
        if (!item.product_id) return;

        const unitCost = Number(item.unit_cost);
        const taxRate =
          item.tax_rate !== null && item.tax_rate !== undefined
            ? Number(item.tax_rate)
            : undefined;
        const current = map.get(item.product_id);

        if (!current) {
          map.set(item.product_id, {
            product_id: item.product_id,
            name: item.name,
            unit_cost: Number.isFinite(unitCost) ? unitCost : 0,
            tax_rate:
              taxRate !== undefined && Number.isFinite(taxRate)
                ? taxRate
                : undefined,
            lastDate: purchase.purchase_date,
            count: 1,
          });
          return;
        }

        const isMoreRecent =
          !current.lastDate ||
          new Date(purchase.purchase_date) > new Date(current.lastDate);

        map.set(item.product_id, {
          ...current,
          name: isMoreRecent ? item.name : current.name,
          unit_cost:
            isMoreRecent && Number.isFinite(unitCost)
              ? unitCost
              : current.unit_cost,
          tax_rate:
            isMoreRecent && taxRate !== undefined && Number.isFinite(taxRate)
              ? taxRate
              : current.tax_rate,
          lastDate: isMoreRecent ? purchase.purchase_date : current.lastDate,
          count: current.count + 1,
        });
      });
    });

    return Array.from(map.values())
      .sort((left, right) => {
        if (left.count !== right.count) {
          return right.count - left.count;
        }

        const leftDate = left.lastDate ? new Date(left.lastDate).getTime() : 0;
        const rightDate = right.lastDate
          ? new Date(right.lastDate).getTime()
          : 0;

        return rightDate - leftDate;
      })
      .slice(0, 8);
  }, [supplierPurchaseHistory]);

  const frequentPurchaseProducts = useMemo(() => {
    const map = new Map<
      number,
      {
        product_id: number;
        name: string;
        unit_cost: number;
        tax_rate?: number;
        count: number;
      }
    >();

    purchases.forEach((purchase) => {
      purchase.items.forEach((item) => {
        if (!item.product_id) return;

        const unitCost = Number(item.unit_cost);
        const taxRate =
          item.tax_rate !== null && item.tax_rate !== undefined
            ? Number(item.tax_rate)
            : undefined;
        const current = map.get(item.product_id);

        if (!current) {
          map.set(item.product_id, {
            product_id: item.product_id,
            name: item.name,
            unit_cost: Number.isFinite(unitCost) ? unitCost : 0,
            tax_rate:
              taxRate !== undefined && Number.isFinite(taxRate)
                ? taxRate
                : undefined,
            count: 1,
          });
          return;
        }

        map.set(item.product_id, {
          ...current,
          count: current.count + 1,
        });
      });
    });

    return Array.from(map.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 10);
  }, [purchases]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;

    items.forEach((item) => {
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unit_cost);
      const taxRate = Number(item.tax_rate || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      if (!Number.isFinite(unitCost) || unitCost <= 0) return;

      const lineSubtotal = quantity * unitCost;
      subtotal += lineSubtotal;
      if (Number.isFinite(taxRate) && taxRate > 0) {
        tax += (lineSubtotal * taxRate) / 100;
      }
    });

    const total = subtotal + tax;
    const rawPaid = Number(form.amount_paid || 0);
    const paidAmount =
      form.payment_status === "PAID"
        ? total
        : Number.isFinite(rawPaid)
          ? Math.max(rawPaid, 0)
          : 0;
    const dueAmount = Math.max(total - Math.min(paidAmount, total), 0);

    return {
      subtotal,
      tax,
      total,
      paidAmount: Math.min(paidAmount, total),
      dueAmount,
    };
  }, [form.amount_paid, form.payment_status, items]);

  const handleItemChange = (
    index: number,
    key: "quantity" | "unit_cost" | "tax_rate",
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item,
      ),
    );
    setLineItemSummary([]);
    setLineItemErrors([]);
    setServerError(null);
  };

  const handleProductSelect = (index: number, product: Product | null) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;

        if (!product) {
          return {
            ...item,
            product_id: "",
            product_label: "",
          };
        }

        return {
          ...item,
          product_id: String(product.id),
          product_label: product.sku
            ? `${product.name} - ${product.sku}`
            : product.name,
          unit_cost: product.cost ?? product.price ?? item.unit_cost,
          tax_rate:
            product.gst_rate !== undefined && product.gst_rate !== null
              ? String(product.gst_rate)
              : item.tax_rate,
        };
      }),
    );
    setLineItemErrors([]);
    setLineItemSummary([]);
    setServerError(null);

    if (product) {
      window.setTimeout(() => {
        quantityInputRefs.current[index]?.focus();
        quantityInputRefs.current[index]?.select();
      }, 40);
    }
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyPurchaseItem()]);
    setLineItemErrors([]);
    setLineItemSummary([]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setLineItemErrors([]);
    setLineItemSummary([]);
  };

  const resetForm = () => {
    setForm({
      supplier_id: "",
      warehouse_id: "",
      purchase_date: "",
      payment_status: "UNPAID",
      amount_paid: "",
      payment_date: "",
      payment_method: "",
      notes: "",
    });
    setItems([createEmptyPurchaseItem()]);
    setEditingId(null);
    setLineItemErrors([]);
    setLineItemSummary([]);
    setPaymentError(null);
    setServerError(null);
  };

  const appendSuggestedItem = (
    suggestion: Pick<
      PurchaseSuggestionItem,
      | "product_id"
      | "product_name"
      | "recommended_reorder_quantity"
      | "unit_cost"
    >,
    taxRate?: number,
  ) => {
    setItems((prev) => {
      const nextItem: PurchaseFormItem = {
        product_id: String(suggestion.product_id),
        product_label: suggestion.product_name,
        quantity: String(suggestion.recommended_reorder_quantity),
        unit_cost: String(suggestion.unit_cost),
        tax_rate: taxRate !== undefined ? String(taxRate) : "",
      };

      const firstEmptyIndex = prev.findIndex((item) => !item.product_id);
      if (firstEmptyIndex >= 0) {
        return prev.map((item, index) =>
          index === firstEmptyIndex ? nextItem : item,
        );
      }

      return [...prev, nextItem];
    });
    setLineItemErrors([]);
    setLineItemSummary([]);
    setServerError(null);
  };

  const repeatLastPurchaseForSelectedSupplier = () => {
    if (!selectedSupplierId) return;

    const latest = purchases.find(
      (purchase) => purchase.supplier?.id === selectedSupplierId,
    );
    if (!latest) return;

    setEditingId(null);
    setItems(
      latest.items.map((item) => ({
        product_id: item.product_id ? String(item.product_id) : "",
        product_label: item.name,
        quantity: String(item.quantity),
        unit_cost: String(item.unit_cost),
        tax_rate: item.tax_rate ? String(item.tax_rate) : "",
      })),
    );
    setForm((prev) => ({
      ...prev,
      notes: prev.notes.trim() || `Repeated from PO-${latest.id}`,
    }));
    setLineItemErrors([]);
    setLineItemSummary([]);
    setServerError(null);
    captureAnalyticsEvent("purchase_suggestions_loaded", {
      source: "repeat_last_purchase",
      itemCount: latest.items.length,
      supplierId: selectedSupplierId,
    });
  };

  const addFrequentlyUsedItems = () => {
    const existingProductIds = new Set(
      items.map((item) => Number(item.product_id)).filter((id) => id > 0),
    );

    const candidates = frequentPurchaseProducts
      .filter((item) => !existingProductIds.has(item.product_id))
      .slice(0, 3);

    if (candidates.length === 0) {
      return;
    }

    setItems((prev) => [
      ...prev,
      ...candidates.map((item) => ({
        product_id: String(item.product_id),
        product_label: item.name,
        quantity: "1",
        unit_cost: String(item.unit_cost || ""),
        tax_rate: item.tax_rate !== undefined ? String(item.tax_rate) : "",
      })),
    ]);
    setLineItemErrors([]);
    setLineItemSummary([]);
    captureAnalyticsEvent("purchase_suggestions_loaded", {
      source: "add_frequent_items",
      itemCount: candidates.length,
    });
  };

  const loadSuggestedItemsIntoForm = (
    suggestedItems: PurchaseSuggestionItem[],
  ) => {
    if (suggestedItems.length === 0) return;

    const firstWarehouseId =
      suggestedItems.find((item) => item.warehouseId)?.warehouseId ?? null;
    const firstSupplierId =
      suggestedItems.find((item) => item.supplierId)?.supplierId ?? null;

    setEditingId(null);
    setForm((prev) => ({
      ...prev,
      supplier_id: firstSupplierId ? String(firstSupplierId) : prev.supplier_id,
      warehouse_id: firstWarehouseId
        ? String(firstWarehouseId)
        : prev.warehouse_id,
      notes: prev.notes.trim() || "Loaded from predictive restock suggestions.",
    }));
    setItems(
      suggestedItems.map((item) => ({
        product_id: String(item.product_id),
        product_label: item.product_name,
        quantity: String(item.recommended_reorder_quantity),
        unit_cost: String(item.unit_cost),
        tax_rate: "",
      })),
    );
    setLineItemErrors([]);
    setLineItemSummary([]);
    setPaymentError(null);
    setServerError(null);
    captureAnalyticsEvent("purchase_suggestions_loaded", {
      source: "purchase_panel",
      itemCount: suggestedItems.length,
      warehouseId: firstWarehouseId,
      supplierId: firstSupplierId,
    });
  };

  const parseServerErrors = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as
        | { message?: string; errors?: Record<string, string[]> }
        | undefined;
      const messages = new Set<string>();
      if (data?.message) messages.add(data.message);
      if (data?.errors) {
        Object.values(data.errors).forEach((values) => {
          values.forEach((value) => messages.add(value));
        });
      }
      if (messages.size) return Array.from(messages).join(" ");
    }
    return fallback;
  };

  const validateSupplierForm = () => {
    const errors: Partial<Record<keyof typeof supplierForm, string>> = {};
    const normalizedName = supplierForm.name.trim();
    const normalizedEmail = supplierForm.email.trim();
    const normalizedPhone = supplierForm.phone.replace(/\D/g, "").slice(0, 10);

    const nameError = validateName(normalizedName);
    if (nameError) {
      errors.name = translateValidationMessage(t, nameError);
    }

    if (normalizedEmail) {
      const emailError = validateEmail(normalizedEmail);
      if (emailError) {
        errors.email = translateValidationMessage(t, emailError);
      }
    }

    const phoneError = validatePhone(normalizedPhone);
    if (phoneError) {
      errors.phone = translateValidationMessage(t, phoneError);
    }

    return Object.keys(errors).length === 0;
  };

  const validateItems = () => {
    const errors: PurchaseLineItemError[] = items.map(() => ({}));
    const summary: string[] = [];
    let missingProduct = false;
    let invalidQuantity = false;
    let invalidCost = false;
    let invalidTax = false;

    items.forEach((item, index) => {
      if (!item.product_id) {
        errors[index].product_id = t("purchasesPage.lineItems.errors.product");
        missingProduct = true;
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors[index].quantity = t("purchasesPage.lineItems.errors.quantity");
        invalidQuantity = true;
      }

      const unitCost = Number(item.unit_cost);
      if (!Number.isFinite(unitCost) || unitCost <= 0) {
        errors[index].unit_cost = t("purchasesPage.lineItems.errors.unitCost");
        invalidCost = true;
      }

      if (item.tax_rate) {
        const taxRate = Number(item.tax_rate);
        if (!Number.isFinite(taxRate) || taxRate < 0) {
          errors[index].tax_rate = t("purchasesPage.lineItems.errors.taxRate");
          invalidTax = true;
        }
      }
    });

    if (missingProduct)
      summary.push(t("purchasesPage.lineItems.summary.product"));
    if (invalidQuantity)
      summary.push(t("purchasesPage.lineItems.summary.quantity"));
    if (invalidCost)
      summary.push(t("purchasesPage.lineItems.summary.unitCost"));
    if (invalidTax) summary.push(t("purchasesPage.lineItems.summary.taxRate"));

    setLineItemErrors(errors);
    setLineItemSummary(summary);
    return summary.length === 0;
  };

  const validatePaymentSection = () => {
    const status = form.payment_status;
    const paid = Number(form.amount_paid || 0);

    if (status === "PAID") {
      if (!form.payment_method) {
        setPaymentError(t("purchasesPage.validation.paymentMethodRequired"));
        return false;
      }

      if (totals.total <= 0) {
        setPaymentError(t("purchasesPage.validation.totalRequired"));
        return false;
      }
    }

    if (status === "PARTIALLY_PAID") {
      if (!Number.isFinite(paid) || paid <= 0) {
        setPaymentError(t("purchasesPage.validation.partialPaidRequired"));
        return false;
      }

      if (paid >= totals.total && totals.total > 0) {
        setPaymentError(t("purchasesPage.validation.partialPaidTooHigh"));
        return false;
      }
    }

    setPaymentError(null);
    return true;
  };

  const handleEditPurchase = (purchase: (typeof purchases)[number]) => {
    setEditingId(purchase.id);
    setForm({
      supplier_id: purchase.supplier?.id ? String(purchase.supplier.id) : "",
      warehouse_id: purchase.warehouse?.id ? String(purchase.warehouse.id) : "",
      purchase_date: purchase.purchase_date
        ? new Date(purchase.purchase_date).toISOString().slice(0, 10)
        : "",
      payment_status: purchase.paymentStatus ?? "UNPAID",
      amount_paid: String(purchase.paidAmount ?? 0),
      payment_date: purchase.paymentDate
        ? new Date(purchase.paymentDate).toISOString().slice(0, 10)
        : "",
      payment_method: purchase.paymentMethod ?? "",
      notes: purchase.notes ?? "",
    });
    setItems(
      purchase.items.map((item) => ({
        product_id: item.product_id ? String(item.product_id) : "",
        product_label: item.name ?? "",
        quantity: String(item.quantity),
        unit_cost: String(item.unit_cost),
        tax_rate: item.tax_rate ? String(item.tax_rate) : "",
      })),
    );
    setLineItemErrors([]);
    setLineItemSummary([]);
    setPaymentError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateItems()) return;
    if (!validatePaymentSection()) return;
    setServerError(null);

    const resolvedPaidAmount =
      form.payment_status === "PAID"
        ? totals.total
        : form.amount_paid
          ? Number(form.amount_paid)
          : undefined;

    const payload = {
      supplier_id: form.supplier_id ? Number(form.supplier_id) : undefined,
      warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
      purchase_date: form.purchase_date || undefined,
      payment_status: form.payment_status as
        | "PAID"
        | "PARTIALLY_PAID"
        | "UNPAID",
      amount_paid: resolvedPaidAmount,
      payment_date: form.payment_date || undefined,
      payment_method:
        (form.payment_method as
          | "CASH"
          | "CARD"
          | "BANK_TRANSFER"
          | "UPI"
          | "CHEQUE"
          | "OTHER"
          | "") || undefined,
      notes: form.notes.trim() || undefined,
      items: items.map((item) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost),
        tax_rate: item.tax_rate ? Number(item.tax_rate) : undefined,
      })),
    };

    try {
      if (editingId) {
        await updatePurchase.mutateAsync({ id: editingId, payload });
      } else {
        await createPurchase.mutateAsync(payload);
      }

      captureAnalyticsEvent("purchase_saved", {
        mode: editingId ? "update" : "create",
        itemCount: payload.items.length,
        supplierId: payload.supplier_id ?? null,
        warehouseId: payload.warehouse_id ?? null,
        paymentStatus: payload.payment_status,
        total: totals.total,
      });
      resetForm();
    } catch (error) {
      setServerError(parseServerErrors(error, t("purchasesPage.saveError")));
    }
  };

  const handleCreateSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    setSupplierError(null);
    if (!validateSupplierForm()) return;

    try {
      const created = await createSupplier.mutateAsync({
        name: supplierForm.name.trim(),
        email: supplierForm.email.trim() || undefined,
        phone: supplierForm.phone.replace(/\D/g, "").slice(0, 10),
        address: supplierForm.address.trim() || undefined,
      });

      setSupplierDialogOpen(false);
      setSupplierForm({ name: "", email: "", phone: "", address: "" });
      setForm((prev) => ({ ...prev, supplier_id: String(created.id) }));
    } catch (error) {
      setSupplierError(
        parseServerErrors(error, t("purchasesPage.supplierForm.saveError")),
      );
    }
  };

  useEffect(() => {
    if (hasAppliedSearchPrefill) return;

    const productId = searchParams.get("productId");
    if (!productId) return;

    const warehouseId = searchParams.get("warehouseId");
    const quantity = searchParams.get("quantity");
    const unitCost = searchParams.get("unitCost");
    const productLabel =
      searchParams.get("productLabel") ?? "Suggested product";

    const timeoutId = window.setTimeout(() => {
      setEditingId(null);
      setForm((prev) => ({
        ...prev,
        warehouse_id: warehouseId ?? prev.warehouse_id,
        notes:
          prev.notes.trim() || "Loaded from inventory purchase suggestion.",
      }));
      setItems([
        {
          product_id: productId,
          product_label: productLabel,
          quantity: quantity ?? "1",
          unit_cost: unitCost ?? "",
          tax_rate: "",
        },
      ]);
      setLineItemErrors([]);
      setLineItemSummary([]);
      setPaymentError(null);
      setServerError(null);
      setHasAppliedSearchPrefill(true);
      captureAnalyticsEvent("purchase_suggestion_prefilled", {
        source: "inventory_page",
        productId,
        warehouseId,
        quantity,
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [hasAppliedSearchPrefill, searchParams]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COMPACT_MODE_STORAGE_KEY,
        isCompactMode ? "1" : "0",
      );
    } catch {
      // Ignore storage issues (private mode, disabled storage, etc.)
    }
  }, [isCompactMode]);

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("purchasesPage.title")}
      subtitle={t("purchasesPage.subtitle")}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8a6d56]">
            {t("purchasesPage.kicker")}
          </p>
          <p className="max-w-2xl text-base text-[#5c4b3b]">
            {t("purchasesPage.subtitle")}
          </p>
        </div>

        <div className="mt-6">
          <SuggestedPurchasesPanel
            warehouseId={
              form.warehouse_id ? Number(form.warehouse_id) : undefined
            }
            onLoadItems={loadSuggestedItemsIntoForm}
            onAppendItem={(item) => {
              appendSuggestedItem(item);
            }}
          />
        </div>

        <section className="mt-4 grid gap-4 lg:mt-6 lg:gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-4 sm:p-6">
            <h2 className="text-lg font-semibold">
              {editingId
                ? t("purchasesPage.editTitle")
                : t("purchasesPage.formTitle")}
            </h2>
            <p className="text-sm text-[#8a6d56]">
              {t("purchasesPage.formDescription")}
            </p>
            {editingId && (
              <div className="mt-2 rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-3 py-2 text-xs text-[#8a6d56]">
                {t("purchasesPage.editingNotice", { id: editingId })}
              </div>
            )}
            <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="supplier-smart">
                    {t("purchasesPage.fields.supplier")}
                  </Label>
                  <Dialog
                    open={supplierDialogOpen}
                    onOpenChange={setSupplierDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button type="button" size="sm" variant="outline">
                        {t("purchasesPage.supplierForm.quickAdd")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {t("purchasesPage.supplierForm.title")}
                        </DialogTitle>
                        <DialogDescription>
                          {t("purchasesPage.supplierForm.description")}
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        className="grid gap-3"
                        onSubmit={handleCreateSupplier}
                      >
                        <ValidationField
                          id="new-supplier-name"
                          label={t("purchasesPage.supplierForm.fields.name")}
                          value={supplierForm.name}
                          onChange={(value) =>
                            setSupplierForm((prev) => ({
                              ...prev,
                              name: value,
                            }))
                          }
                          validate={(value) =>
                            value
                              ? withTranslatedValidation(validateName)(value)
                              : ""
                          }
                          required
                          success
                        />
                        <ValidationField
                          id="new-supplier-phone"
                          label={t("purchasesPage.supplierForm.fields.phone")}
                          value={supplierForm.phone}
                          onChange={(value) =>
                            setSupplierForm((prev) => ({
                              ...prev,
                              phone: value.replace(/\D/g, "").slice(0, 10),
                            }))
                          }
                          validate={(value) =>
                            value
                              ? withTranslatedValidation(validatePhone)(value)
                              : ""
                          }
                          inputMode="numeric"
                          maxLength={10}
                          required
                          success
                        />
                        <ValidationField
                          id="new-supplier-email"
                          label={t("purchasesPage.supplierForm.fields.email")}
                          value={supplierForm.email}
                          onChange={(value) =>
                            setSupplierForm((prev) => ({
                              ...prev,
                              email: value,
                            }))
                          }
                          validate={(value) =>
                            value
                              ? withTranslatedValidation(validateEmail)(value)
                              : ""
                          }
                          success
                        />
                        <ValidationField
                          id="new-supplier-address"
                          label={t("purchasesPage.supplierForm.fields.address")}
                          value={supplierForm.address}
                          onChange={(value) =>
                            setSupplierForm((prev) => ({
                              ...prev,
                              address: value,
                            }))
                          }
                          validate={() => ""}
                          success
                        />
                        {supplierError ? (
                          <p className="text-sm text-[#b45309]">
                            {supplierError}
                          </p>
                        ) : null}
                        <Button
                          type="submit"
                          disabled={createSupplier.isPending}
                        >
                          {t("purchasesPage.supplierForm.save")}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <SmartSupplierSelect
                  value={form.supplier_id}
                  suppliers={supplierInsights}
                  directLabel={t("purchasesPage.directPurchase")}
                  searchPlaceholder={t("purchasesPage.smart.searchSupplier")}
                  filterPlaceholder={t("purchasesPage.smart.filterByCategory")}
                  allCategoriesLabel={t("purchasesPage.smart.allCategories")}
                  frequentLabel={t("purchasesPage.smart.frequent")}
                  lastPurchaseLabel={t("purchasesPage.smart.lastPurchase")}
                  outstandingLabel={t("purchasesPage.smart.outstanding")}
                  noResultsLabel={t("purchasesPage.smart.noSuppliers")}
                  selectedSummaryLabel={t("purchasesPage.smart.selected")}
                  onChange={(nextValue) => {
                    setPaymentError(null);
                    setForm((prev) => ({ ...prev, supplier_id: nextValue }));
                  }}
                  formatDate={formatPurchaseDate}
                  formatCurrency={(value) => formatAmount(value)}
                />
              </div>

              <div className="grid gap-2 rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a6d56]">
                  {t("purchasesPage.quickActions.title")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={repeatLastPurchaseForSelectedSupplier}
                    disabled={supplierPurchaseHistory.length === 0}
                  >
                    {t("purchasesPage.quickActions.repeatLast")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addFrequentlyUsedItems}
                    disabled={frequentPurchaseProducts.length === 0}
                  >
                    {t("purchasesPage.quickActions.addFrequent")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCompactMode((prev) => !prev)}
                  >
                    {isCompactMode
                      ? t("purchasesPage.quickActions.compactOff")
                      : t("purchasesPage.quickActions.compactOn")}
                  </Button>
                </div>
              </div>

              {suggestedProductsForSupplier.length > 0 ? (
                <div className="grid gap-2 rounded-xl border border-[#f2e6dc] bg-white p-3">
                  <p className="text-sm font-semibold text-[#1f1b16]">
                    {t("purchasesPage.smart.suggestedFromSupplier")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedProductsForSupplier.map((item) => (
                      <Button
                        key={item.product_id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() =>
                          appendSuggestedItem(
                            {
                              product_id: item.product_id,
                              product_name: item.name,
                              recommended_reorder_quantity: 1,
                              unit_cost: item.unit_cost,
                            },
                            item.tax_rate,
                          )
                        }
                      >
                        {item.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="warehouse">
                  {t("purchasesPage.fields.warehouse")}
                </Label>
                <ValidationField
                  id="warehouse"
                  label={t("purchasesPage.fields.warehouse")}
                  as="select"
                  value={form.warehouse_id}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, warehouse_id: value }))
                  }
                  validate={(value) =>
                    value ? "" : t("purchasesPage.validation.selectWarehouse")
                  }
                  required
                  success
                >
                  <option value="">{t("purchasesPage.defaultStock")}</option>
                  {warehouseList.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </ValidationField>
              </div>

              <ValidationField
                id="purchase_date"
                label={t("purchasesPage.fields.purchaseDate")}
                type="date"
                value={form.purchase_date}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, purchase_date: value }))
                }
                validate={withTranslatedValidation(validateDate)}
                required
                success
              />

              <ValidationField
                id="notes"
                label={t("purchasesPage.fields.notes")}
                value={form.notes}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, notes: value }))
                }
                validate={() => ""}
                placeholder={t("purchasesPage.placeholders.notes")}
                success
              />

              <div className="grid gap-3 rounded-xl border border-[#f2e6dc] bg-[#fffaf6] p-3">
                <ValidationField
                  id="payment_status"
                  label={t("purchasesPage.fields.paymentStatus")}
                  as="select"
                  value={form.payment_status}
                  onChange={(value) => {
                    setPaymentError(null);
                    setForm((prev) => ({ ...prev, payment_status: value }));
                  }}
                  validate={withTranslatedValidation(validateRequired)}
                  required
                  success
                >
                  <option value="UNPAID">
                    {translatePaymentStatus("UNPAID")}
                  </option>
                  <option value="PARTIALLY_PAID">
                    {translatePaymentStatus("PARTIALLY_PAID")}
                  </option>
                  <option value="PAID">{translatePaymentStatus("PAID")}</option>
                </ValidationField>

                {form.payment_status !== "UNPAID" ? (
                  <ValidationField
                    id="amount_paid"
                    label={t("purchasesPage.fields.amountPaid")}
                    type="number"
                    value={form.amount_paid}
                    onChange={(value) => {
                      setPaymentError(null);
                      setForm((prev) => ({ ...prev, amount_paid: value }));
                    }}
                    validate={(value) =>
                      value
                        ? translateValidationMessage(t, validateNumber(value))
                        : ""
                    }
                    placeholder={t("purchasesPage.placeholders.amountPaid")}
                    success
                  />
                ) : null}

                <ValidationField
                  id="payment_date"
                  label={t("purchasesPage.fields.paymentDate")}
                  type="date"
                  value={form.payment_date}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, payment_date: value }))
                  }
                  validate={withTranslatedValidation(validateDate)}
                  success
                />

                {(form.payment_status === "PAID" ||
                  form.payment_status === "PARTIALLY_PAID") && (
                  <ValidationField
                    id="payment_method"
                    label={t("purchasesPage.fields.paymentMethod")}
                    as="select"
                    value={form.payment_method}
                    onChange={(value) => {
                      setPaymentError(null);
                      setForm((prev) => ({ ...prev, payment_method: value }));
                    }}
                    validate={withTranslatedValidation(validateRequired)}
                    required={form.payment_status === "PAID"}
                    success
                  >
                    <option value="">{t("purchasesPage.selectMethod")}</option>
                    <option value="CASH">
                      {translatePaymentMethod("CASH")}
                    </option>
                    <option value="UPI">{translatePaymentMethod("UPI")}</option>
                    <option value="BANK_TRANSFER">
                      {translatePaymentMethod("BANK_TRANSFER")}
                    </option>
                    <option value="CARD">
                      {translatePaymentMethod("CARD")}
                    </option>
                    <option value="CHEQUE">
                      {translatePaymentMethod("CHEQUE")}
                    </option>
                    <option value="OTHER">
                      {translatePaymentMethod("OTHER")}
                    </option>
                  </ValidationField>
                )}

                {paymentError ? (
                  <p className="text-sm text-[#b45309]">{paymentError}</p>
                ) : null}
              </div>

              <div className="grid gap-2 rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3 text-sm text-[#5c4b3b]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a6d56]">
                  {t("purchasesPage.summary.title")}
                </p>
                <div className="flex items-center justify-between">
                  <span>{t("purchasesPage.summary.subtotal")}</span>
                  <span className="font-semibold">
                    {formatAmount(totals.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("purchasesPage.summary.tax")}</span>
                  <span className="font-semibold">
                    {formatAmount(totals.tax)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-[#ead8c7] pt-2 text-base text-[#1f1b16]">
                  <span>{t("purchasesPage.summary.total")}</span>
                  <span className="font-semibold">
                    {formatAmount(totals.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("purchasesPage.summary.paid")}</span>
                  <span>{formatAmount(totals.paidAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("purchasesPage.summary.due")}</span>
                  <span>{formatAmount(totals.dueAmount)}</span>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label>{t("purchasesPage.lineItems.title")}</Label>
                  <Button type="button" variant="outline" onClick={addItem}>
                    {t("purchasesPage.lineItems.addItem")}
                  </Button>
                </div>
                {lineItemSummary.length > 0 && (
                  <div className="rounded-xl border border-[#f2e6dc] bg-white px-3 py-2 text-xs text-[#b45309]">
                    <p className="font-semibold">
                      {t("purchasesPage.lineItems.fixTitle")}
                    </p>
                    <ul className="mt-1 list-disc pl-4">
                      {lineItemSummary.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {items.map((item, index) => (
                  <div
                    key={`item-${index}`}
                    className={cn(
                      "rounded-xl border border-[#f2e6dc] bg-[#fff9f2]",
                      isCompactMode ? "grid gap-2 p-2" : "grid gap-3 p-3",
                    )}
                  >
                    <div className="grid gap-2">
                      <Label>
                        {t("purchasesPage.lineItems.fields.product")}
                      </Label>
                      <AsyncProductSelect
                        value={item.product_id}
                        selectedLabel={item.product_label}
                        onSelect={(product) =>
                          handleProductSelect(index, product)
                        }
                        variant="warm"
                      />
                      {lineItemErrors[index]?.product_id && (
                        <p className="text-xs text-[#b45309]">
                          {lineItemErrors[index]?.product_id}
                        </p>
                      )}
                    </div>
                    <div
                      className={cn(
                        "grid gap-2",
                        isCompactMode && "grid-cols-1 sm:grid-cols-3",
                      )}
                    >
                      <div className="grid gap-2">
                        <Label>
                          {t("purchasesPage.lineItems.fields.quantity")}
                        </Label>
                        <Input
                          type="number"
                          ref={(element) => {
                            quantityInputRefs.current[index] = element;
                          }}
                          value={item.quantity}
                          onChange={(event) =>
                            handleItemChange(
                              index,
                              "quantity",
                              event.target.value,
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              unitCostInputRefs.current[index]?.focus();
                              unitCostInputRefs.current[index]?.select();
                            }
                          }}
                          required
                        />
                        {lineItemErrors[index]?.quantity && (
                          <p className="text-xs text-[#b45309]">
                            {lineItemErrors[index]?.quantity}
                          </p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label>
                          {t("purchasesPage.lineItems.fields.unitCost")}
                        </Label>
                        <Input
                          type="number"
                          ref={(element) => {
                            unitCostInputRefs.current[index] = element;
                          }}
                          value={item.unit_cost}
                          onChange={(event) =>
                            handleItemChange(
                              index,
                              "unit_cost",
                              event.target.value,
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              taxRateInputRefs.current[index]?.focus();
                              taxRateInputRefs.current[index]?.select();
                            }
                          }}
                          required
                        />
                        {lineItemErrors[index]?.unit_cost && (
                          <p className="text-xs text-[#b45309]">
                            {lineItemErrors[index]?.unit_cost}
                          </p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label>
                          {t("purchasesPage.lineItems.fields.taxRate")}
                        </Label>
                        <Input
                          type="number"
                          ref={(element) => {
                            taxRateInputRefs.current[index] = element;
                          }}
                          value={item.tax_rate}
                          onChange={(event) =>
                            handleItemChange(
                              index,
                              "tax_rate",
                              event.target.value,
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              if (index === items.length - 1) {
                                addItem();
                                window.setTimeout(() => {
                                  quantityInputRefs.current[index + 1]?.focus();
                                }, 40);
                              } else {
                                quantityInputRefs.current[index + 1]?.focus();
                              }
                            }
                          }}
                          placeholder={t("purchasesPage.optional")}
                        />
                        {lineItemErrors[index]?.tax_rate && (
                          <p className="text-xs text-[#b45309]">
                            {lineItemErrors[index]?.tax_rate}
                          </p>
                        )}
                      </div>
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => removeItem(index)}
                      >
                        {t("purchasesPage.lineItems.removeItem")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="sticky bottom-1 z-10 grid gap-2 rounded-xl border border-[#e4d4c7] bg-white/95 p-3 backdrop-blur">
                <Button
                  type="submit"
                  className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                  disabled={
                    createPurchase.isPending || updatePurchase.isPending
                  }
                >
                  {editingId
                    ? t("purchasesPage.updatePurchase")
                    : t("purchasesPage.savePurchase")}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t("purchasesPage.cancelEdit")}
                  </Button>
                )}
                {(createPurchase.isError ||
                  updatePurchase.isError ||
                  serverError) && (
                  <p className="text-sm text-[#b45309]">
                    {serverError ?? t("purchasesPage.saveError")}
                  </p>
                )}
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-4 sm:p-6">
            <h2 className="text-lg font-semibold">
              {t("purchasesPage.listTitle")}
            </h2>
            <p className="text-sm text-[#8a6d56]">
              {t("purchasesPage.listDescription")}
            </p>
            <div className="mt-4">
              {isLoading && (
                <p className="text-sm text-[#8a6d56]">
                  {t("purchasesPage.loading")}
                </p>
              )}
              {isError && (
                <p className="text-sm text-[#b45309]">
                  {t("purchasesPage.loadError")}
                </p>
              )}
              {!isLoading && !isError && purchases.length === 0 && (
                <p className="text-sm text-[#8a6d56]">
                  {t("purchasesPage.empty")}
                </p>
              )}
              {!isLoading && !isError && purchases.length > 0 && (
                <div className="grid gap-3">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-3"
                    >
                      <div>
                        <p className="text-base font-semibold">
                          {t("purchasesPage.purchaseCode", { id: purchase.id })}{" "}
                          -{" "}
                          {purchase.supplier?.name ?? t("purchasesPage.direct")}
                        </p>
                        <p className="text-xs text-[#8a6d56]">
                          {formatPurchaseDate(purchase.purchase_date)} -{" "}
                          {t("purchasesPage.itemsCount", {
                            count: purchase.items.length,
                          })}
                          {purchase.warehouse?.name
                            ? ` - ${t("purchasesPage.warehouseName", {
                                name: purchase.warehouse.name,
                              })}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-[#5c4b3b]">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStatusBadgeClass(
                            purchase.paymentStatus,
                          )}`}
                        >
                          {translatePaymentStatus(purchase.paymentStatus)}
                        </span>
                        <span>
                          {t("purchasesPage.totals.total", {
                            amount: formatAmount(purchase.totalAmount),
                          })}
                        </span>
                        <span>
                          {t("purchasesPage.totals.paid", {
                            amount: formatAmount(purchase.paidAmount),
                          })}
                        </span>
                        <span>
                          {t("purchasesPage.totals.pending", {
                            amount: formatAmount(purchase.pendingAmount),
                          })}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleEditPurchase(purchase)}
                        >
                          {t("purchasesPage.edit")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default PurchasesClient;
