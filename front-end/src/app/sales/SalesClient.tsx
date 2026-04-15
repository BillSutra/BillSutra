"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import AsyncProductSelect, {
  type AsyncProductSelectHandle,
} from "@/components/products/AsyncProductSelect";
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
import { Label } from "@/components/ui/label";
import {
  useCreateCustomerMutation,
  useCreateSaleMutation,
  useCustomersQuery,
  useDeleteSaleMutation,
  useInventoriesQuery,
  useProductsQuery,
  useSalesQuery,
  useUpdateSaleMutation,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";
import type { Product } from "@/lib/apiClient";
import { useI18n } from "@/providers/LanguageProvider";

const humanizeEnum = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

type SalesClientProps = {
  name: string;
  image?: string;
};

type SaleLineItemError = {
  product_id?: string;
  quantity?: string;
  unit_price?: string;
};

type SaleFormItem = {
  product_id: string;
  product_label: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
};

const createEmptySaleItem = (): SaleFormItem => ({
  product_id: "",
  product_label: "",
  quantity: "1",
  unit_price: "",
  tax_rate: "",
});

const getTodayValue = () => new Date().toISOString().slice(0, 10);

const SalesClient = ({ name, image }: SalesClientProps) => {
  const { t, safeT, formatCurrency, formatDate } = useI18n();
  const productSearchRef = useRef<AsyncProductSelectHandle | null>(null);
  const quantityInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const { data, isLoading, isError } = useSalesQuery();
  const { data: customers } = useCustomersQuery();
  const { data: warehouses } = useWarehousesQuery();
  const { data: products } = useProductsQuery({ limit: 1000 });
  const { data: inventories } = useInventoriesQuery();
  const createSale = useCreateSaleMutation();
  const updateSale = useUpdateSaleMutation();
  const deleteSale = useDeleteSaleMutation();
  const createCustomer = useCreateCustomerMutation();
  const [form, setForm] = useState({
    customer_id: "",
    warehouse_id: "",
    sale_date: getTodayValue(),
    payment_status: "PAID",
    amount_paid: "",
    payment_date: getTodayValue(),
    payment_method: "CASH",
    notes: "",
  });
  const [items, setItems] = useState<SaleFormItem[]>([]);
  const [lineItemErrors, setLineItemErrors] = useState<SaleLineItemError[]>([]);
  const [lineItemSummary, setLineItemSummary] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [customerFieldErrors, setCustomerFieldErrors] = useState<
    Partial<Record<keyof typeof customerForm, string>>
  >({});
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState("COMPLETED");
  const [editingPaymentStatus, setEditingPaymentStatus] = useState("UNPAID");
  const [editingAmountPaid, setEditingAmountPaid] = useState("0");
  const [editingPaymentDate, setEditingPaymentDate] = useState("");
  const [editingPaymentMethod, setEditingPaymentMethod] = useState("");
  const [editingNotes, setEditingNotes] = useState("");

  const sales = useMemo(() => data ?? [], [data]);
  const customerList = customers ?? [];
  const warehouseList = warehouses ?? [];
  const productList = products ?? [];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      productSearchRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const formatSaleDate = (value: string) =>
    formatDate(new Date(value), { dateStyle: "medium" });

  const formatAmount = (value: string | number) =>
    formatCurrency(Number(value || 0), "INR");

  const translatePaymentStatus = (status: string) => {
    const key = `dashboard.enums.paymentStatus.${status}`;
    return safeT(key, humanizeEnum(status));
  };

  const translatePaymentMethod = (value: string) => {
    const key = `dashboard.enums.paymentMethod.${value}`;
    return safeT(key, humanizeEnum(value));
  };

  const translateSaleStatus = (status: string) => {
    const key = `salesPage.status.${status}`;
    return safeT(key, humanizeEnum(status));
  };

  const paymentStatusBadgeClass = (status: string) => {
    if (status === "PAID") return "bg-emerald-100 text-emerald-700";
    if (status === "PARTIALLY_PAID") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  };

  const inventoryByWarehouseProduct = useMemo(() => {
    const map = new Map<string, number>();

    (inventories ?? []).forEach((inventory) => {
      const warehouseId = inventory.warehouse_id ?? inventory.warehouse?.id;
      const productId = inventory.product_id ?? inventory.product?.id;
      if (!warehouseId || !productId) return;
      map.set(`${warehouseId}:${productId}`, inventory.quantity);
    });

    return map;
  }, [inventories]);

  const salesProductFrequency = useMemo(() => {
    const map = new Map<number, { count: number; product: Product }>();

    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (!item.product_id) return;
        const product = productList.find((entry) => entry.id === item.product_id);
        if (!product) return;

        const current = map.get(item.product_id) ?? { count: 0, product };
        map.set(item.product_id, {
          count: current.count + Number(item.quantity ?? 0),
          product,
        });
      });
    });

    return Array.from(map.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 6)
      .map((entry) => entry.product);
  }, [productList, sales]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;

    items.forEach((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      const taxRate = Number(item.tax_rate || 0);

      if (!Number.isFinite(quantity) || quantity <= 0) return;
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return;

      const lineSubtotal = quantity * unitPrice;
      subtotal += lineSubtotal;
      if (Number.isFinite(taxRate) && taxRate > 0) {
        tax += (lineSubtotal * taxRate) / 100;
      }
    });

    const grandTotal = subtotal + tax;
    const partialAmount =
      form.payment_status === "PARTIALLY_PAID"
        ? Math.max(Number(form.amount_paid || 0), 0)
        : 0;
    const paidAmount =
      form.payment_status === "PAID"
        ? grandTotal
        : Math.min(partialAmount, grandTotal);

    return {
      subtotal,
      tax,
      grandTotal,
      paidAmount,
      balance: Math.max(grandTotal - paidAmount, 0),
    };
  }, [form.amount_paid, form.payment_status, items]);

  const visibleRecentSales = useMemo(() => sales.slice(0, 8), [sales]);

  const walkInLabel = t("salesPage.customer.walkIn");

  const addItemFromProduct = (product: Product) => {
    setItems((currentItems) => {
      const existingIndex = currentItems.findIndex(
        (item) => item.product_id === String(product.id),
      );

      if (existingIndex >= 0) {
        return currentItems.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity: String(Math.max(1, Number(item.quantity || 0) + 1)),
              }
            : item,
        );
      }

      return [
        ...currentItems,
        {
          product_id: String(product.id),
          product_label: product.sku
            ? `${product.name} - ${product.sku}`
            : product.name,
          quantity: "1",
          unit_price: product.price ?? "",
          tax_rate:
            product.gst_rate !== undefined && product.gst_rate !== null
              ? String(product.gst_rate)
              : "",
        },
      ];
    });

    setLineItemSummary([]);
    setLineItemErrors([]);
    setServerError(null);

    window.setTimeout(() => {
      const nextIndex =
        items.findIndex((item) => item.product_id === String(product.id)) >= 0
          ? items.findIndex((item) => item.product_id === String(product.id))
          : items.length;
      quantityInputRefs.current[nextIndex]?.focus();
      quantityInputRefs.current[nextIndex]?.select();
    }, 50);
  };

  const handleItemChange = (
    index: number,
    key: "quantity" | "unit_price" | "tax_rate",
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
    if (!product) return;

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;

        return {
          ...item,
          product_id: String(product.id),
          product_label: product.sku
            ? `${product.name} - ${product.sku}`
            : product.name,
          unit_price: product.price ?? item.unit_price,
          tax_rate:
            product.gst_rate !== undefined && product.gst_rate !== null
              ? String(product.gst_rate)
              : item.tax_rate,
        };
      }),
    );
    setLineItemSummary([]);
    setLineItemErrors([]);
    setServerError(null);
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptySaleItem()]);
    setLineItemSummary([]);
    setLineItemErrors([]);
    setServerError(null);
    window.setTimeout(() => {
      productSearchRef.current?.focus();
    }, 50);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setLineItemSummary([]);
    setLineItemErrors([]);
    setServerError(null);
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
          const list = Array.isArray(values) ? values : [values];
          list.forEach((value) => messages.add(value));
        });
      }
      if (messages.size) return Array.from(messages).join(" ");
    }
    return fallback;
  };

  const validateCustomerForm = () => {
    const errors: Partial<Record<keyof typeof customerForm, string>> = {};
    if (customerForm.name.trim().length < 2) {
      errors.name = t("salesPage.customer.errors.name");
    }
    if (customerForm.email && !/\S+@\S+\.\S+/.test(customerForm.email)) {
      errors.email = t("validation.validEmail");
    }
    const normalizedPhone = customerForm.phone.replace(/\D/g, "");
    if (!normalizedPhone || normalizedPhone.length !== 10) {
      errors.phone = t("salesPage.customer.errors.phone");
    }

    setCustomerFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateItems = () => {
    const errors: SaleLineItemError[] = items.map(() => ({}));
    const summary: string[] = [];
    let missingProduct = false;
    let invalidQuantity = false;
    let invalidPrice = false;
    let stockIssue = false;

    items.forEach((item, index) => {
      if (!item.product_id) {
        errors[index].product_id = t("salesPage.pos.validation.product");
        missingProduct = true;
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors[index].quantity = t("salesPage.pos.validation.quantity");
        invalidQuantity = true;
      }

      const unitPrice = Number(item.unit_price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        errors[index].unit_price = t("salesPage.pos.validation.price");
        invalidPrice = true;
      }

      const warehouseId = Number(form.warehouse_id || 0);
      const availableStock =
        warehouseId && item.product_id
          ? inventoryByWarehouseProduct.get(`${warehouseId}:${item.product_id}`)
          : undefined;

      if (
        warehouseId &&
        availableStock !== undefined &&
        Number.isFinite(quantity) &&
        quantity > availableStock
      ) {
        errors[index].quantity = t("salesPage.pos.validation.stockLeft", {
          count: availableStock,
        });
        stockIssue = true;
      }
    });

    if (missingProduct) summary.push(t("salesPage.pos.validation.summaryProduct"));
    if (invalidQuantity) summary.push(t("salesPage.pos.validation.summaryQuantity"));
    if (invalidPrice) summary.push(t("salesPage.pos.validation.summaryPrice"));
    if (stockIssue) summary.push(t("salesPage.pos.validation.summaryStock"));

    setLineItemErrors(errors);
    setLineItemSummary(summary);
    return summary.length === 0;
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateItems()) return;
    setServerError(null);

    try {
      await createSale.mutateAsync({
        customer_id: form.customer_id ? Number(form.customer_id) : undefined,
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
        sale_date: form.sale_date || undefined,
        payment_status: form.payment_status as
          | "PAID"
          | "PARTIALLY_PAID"
          | "UNPAID",
        amount_paid:
          form.payment_status === "PAID"
            ? totals.grandTotal
            : form.payment_status === "PARTIALLY_PAID"
              ? Number(form.amount_paid || 0)
              : undefined,
        payment_date:
          form.payment_status === "UNPAID" ? undefined : form.payment_date || undefined,
        payment_method:
          form.payment_status === "UNPAID"
            ? undefined
            : ((form.payment_method as
                | "CASH"
                | "CARD"
                | "BANK_TRANSFER"
                | "UPI"
                | "CHEQUE"
                | "OTHER"
                | "") || undefined),
        notes: form.notes.trim() || undefined,
        items: items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          tax_rate: item.tax_rate ? Number(item.tax_rate) : undefined,
        })),
      });

      setForm({
        customer_id: "",
        warehouse_id: "",
        sale_date: getTodayValue(),
        payment_status: "PAID",
        amount_paid: "",
        payment_date: getTodayValue(),
        payment_method: "CASH",
        notes: "",
      });
      setItems([]);
      setLineItemErrors([]);
      setLineItemSummary([]);
      setShowOptionalFields(false);

      window.setTimeout(() => {
        productSearchRef.current?.focus();
      }, 80);
    } catch (error) {
      setServerError(
        parseServerErrors(error, t("salesPage.messages.saveError")),
      );
    }
  };

  const handleCreateCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    setCustomerError(null);
    if (!validateCustomerForm()) return;

    try {
      const created = await createCustomer.mutateAsync({
        name: customerForm.name.trim(),
        email: customerForm.email.trim() || undefined,
        phone: customerForm.phone.replace(/\D/g, ""),
        address: customerForm.address.trim() || undefined,
      });

      setCustomerDialogOpen(false);
      setCustomerForm({ name: "", email: "", phone: "", address: "" });
      setCustomerFieldErrors({});
      setForm((prev) => ({ ...prev, customer_id: String(created.id) }));
    } catch (error) {
      setCustomerError(
        parseServerErrors(error, t("salesPage.messages.createCustomerError")),
      );
    }
  };

  const handleEdit = (sale: (typeof sales)[number]) => {
    setEditingId(sale.id);
    setEditingStatus(sale.status);
    setEditingPaymentStatus(sale.paymentStatus ?? "UNPAID");
    setEditingAmountPaid(String(sale.paidAmount ?? 0));
    setEditingPaymentDate(
      sale.paymentDate
        ? new Date(sale.paymentDate).toISOString().slice(0, 10)
        : "",
    );
    setEditingPaymentMethod(sale.paymentMethod ?? "");
    setEditingNotes(sale.notes ?? "");
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    try {
      await updateSale.mutateAsync({
        id: editingId,
        payload: {
          status: editingStatus,
          payment_status: editingPaymentStatus as
            | "PAID"
            | "PARTIALLY_PAID"
            | "UNPAID",
          amount_paid: Number(editingAmountPaid || 0),
          payment_date: editingPaymentDate || undefined,
          payment_method:
            (editingPaymentMethod as
              | "CASH"
              | "CARD"
              | "BANK_TRANSFER"
              | "UPI"
              | "CHEQUE"
              | "OTHER"
              | "") || undefined,
          notes: editingNotes.trim() || undefined,
        },
      });
      setEditingId(null);
      setServerError(null);
    } catch (error) {
      setServerError(
        parseServerErrors(error, t("salesPage.messages.updateError")),
      );
    }
  };

  const handleDeleteSale = async (saleId: number) => {
    const confirmed = window.confirm(t("salesPage.messages.deleteConfirm"));
    if (!confirmed) return;

    try {
      await deleteSale.mutateAsync(saleId);
      setServerError(null);
    } catch (error) {
      setServerError(
        parseServerErrors(error, t("salesPage.messages.deleteError")),
      );
    }
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("salesPage.pos.title")}
      subtitle={t("salesPage.pos.subtitle")}
    >
      <div className="mx-auto w-full max-w-7xl">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.9fr)]">
          <div className="grid gap-5">
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowOptionalFields((current) => !current)}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {t("salesPage.pos.setupTitle")}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {t("salesPage.pos.setupDescription")}
                  </p>
                </div>
                <span className="text-xs font-medium text-gray-500">
                  {showOptionalFields ? t("common.hide") : t("common.show")}
                </span>
              </button>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="customer">{t("salesPage.fields.customer")}</Label>
                    <Dialog
                      open={customerDialogOpen}
                      onOpenChange={(open) => {
                        setCustomerDialogOpen(open);
                        if (!open) {
                          setCustomerError(null);
                          setCustomerFieldErrors({});
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-8 rounded-md">
                          {t("salesPage.pos.newCustomer")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("salesPage.customer.addTitle")}</DialogTitle>
                          <DialogDescription>
                            {t("salesPage.customer.addDescription")}
                          </DialogDescription>
                        </DialogHeader>
                        <form className="grid gap-3" onSubmit={handleCreateCustomer}>
                          <div className="grid gap-2">
                            <Label htmlFor="customer_name">
                              {t("salesPage.customer.fields.name")}
                            </Label>
                            <Input
                              id="customer_name"
                              value={customerForm.name}
                              onChange={(event) => {
                                setCustomerForm((prev) => ({
                                  ...prev,
                                  name: event.target.value,
                                }));
                                setCustomerFieldErrors((prev) => ({
                                  ...prev,
                                  name: undefined,
                                }));
                                setCustomerError(null);
                              }}
                            />
                            {customerFieldErrors.name ? (
                              <p className="text-xs text-[#b45309]">
                                {customerFieldErrors.name}
                              </p>
                            ) : null}
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="customer_email">
                              {t("salesPage.customer.fields.email")}
                            </Label>
                            <Input
                              id="customer_email"
                              type="email"
                              value={customerForm.email}
                              onChange={(event) => {
                                setCustomerForm((prev) => ({
                                  ...prev,
                                  email: event.target.value,
                                }));
                                setCustomerFieldErrors((prev) => ({
                                  ...prev,
                                  email: undefined,
                                }));
                                setCustomerError(null);
                              }}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="customer_phone">
                              {t("salesPage.customer.fields.phone")}
                            </Label>
                            <Input
                              id="customer_phone"
                              value={customerForm.phone}
                              onChange={(event) => {
                                setCustomerForm((prev) => ({
                                  ...prev,
                                  phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                                }));
                                setCustomerFieldErrors((prev) => ({
                                  ...prev,
                                  phone: undefined,
                                }));
                                setCustomerError(null);
                              }}
                            />
                            {customerFieldErrors.phone ? (
                              <p className="text-xs text-[#b45309]">
                                {customerFieldErrors.phone}
                              </p>
                            ) : null}
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="customer_address">
                              {t("salesPage.customer.fields.address")}
                            </Label>
                            <Input
                              id="customer_address"
                              value={customerForm.address}
                              onChange={(event) => {
                                setCustomerForm((prev) => ({
                                  ...prev,
                                  address: event.target.value,
                                }));
                                setCustomerError(null);
                              }}
                            />
                          </div>
                          {customerError ? (
                            <p className="text-xs text-[#b45309]">{customerError}</p>
                          ) : null}
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCustomerDialogOpen(false)}
                            >
                              {t("common.cancel")}
                            </Button>
                            <Button type="submit">{t("salesPage.customer.save")}</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <select
                    id="customer"
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                    value={form.customer_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        customer_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">{walkInLabel}</option>
                    {customerList.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="warehouse">{t("salesPage.fields.warehouse")}</Label>
                  <select
                    id="warehouse"
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                    value={form.warehouse_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        warehouse_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">{t("salesPage.defaultStock")}</option>
                    {warehouseList.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sale_date">{t("common.date")}</Label>
                  <Input
                    id="sale_date"
                    type="date"
                    value={form.sale_date}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        sale_date: event.target.value,
                      }))
                    }
                    className="h-10 rounded-md border-gray-300"
                  />
                </div>
              </div>

              {showOptionalFields ? (
                <div className="mt-4 grid gap-2">
                  <Label htmlFor="notes">{t("salesPage.fields.notes")}</Label>
                  <Input
                    id="notes"
                    value={form.notes}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    placeholder={t("salesPage.placeholders.notes")}
                    className="h-10 rounded-md border-gray-300"
                  />
                </div>
              ) : null}
            </div>

            <form id="sales-billing-form" onSubmit={handleCreate} className="grid gap-5">
              <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {t("salesPage.pos.addProductsTitle")}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {t("salesPage.pos.addProductsDescription")}
                    </p>
                  </div>

                  <AsyncProductSelect
                    ref={productSearchRef}
                    value=""
                    selectedLabel=""
                    onSelect={(product) => {
                      if (product) {
                        addItemFromProduct(product);
                      }
                    }}
                    onSubmitSelection={(product) => {
                      if (product) {
                        addItemFromProduct(product);
                        productSearchRef.current?.clear();
                      }
                    }}
                    placeholder={t("salesPage.pos.productSearchPlaceholder")}
                    autoFocus
                    variant="warm"
                    inputClassName="h-12 rounded-lg border-gray-300 text-base"
                  />

                  {salesProductFrequency.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {salesProductFrequency.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addItemFromProduct(product)}
                          className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          {product.name}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-md"
                      onClick={addItem}
                    >
                      {t("salesPage.pos.addItem")}
                    </Button>
                    <div className="flex h-10 items-center rounded-md border border-dashed border-gray-300 px-3 text-sm text-gray-500">
                      {t("salesPage.pos.barcodeReady")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-200 px-4 py-3">
                  <div className="grid grid-cols-[minmax(0,2.2fr)_80px_110px_110px_44px] gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    <span>{t("salesPage.pos.columns.product")}</span>
                    <span>{t("salesPage.pos.columns.qty")}</span>
                    <span>{t("salesPage.pos.columns.price")}</span>
                    <span>{t("salesPage.pos.columns.total")}</span>
                    <span />
                  </div>
                </div>

                {lineItemSummary.length > 0 ? (
                  <div className="border-b border-gray-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {lineItemSummary.join(" • ")}
                  </div>
                ) : null}

                {items.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-gray-500">
                    {t("salesPage.pos.emptyItems")}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {items.map((item, index) => {
                      const quantity = Number(item.quantity || 0);
                      const unitPrice = Number(item.unit_price || 0);
                      const lineTotal = quantity * unitPrice;
                      const availableStock =
                        form.warehouse_id && item.product_id
                          ? inventoryByWarehouseProduct.get(
                              `${form.warehouse_id}:${item.product_id}`,
                            )
                          : undefined;

                      return (
                        <div key={`sale-item-${index}`} className="px-4 py-4">
                          <div className="grid grid-cols-[minmax(0,2.2fr)_80px_110px_110px_44px] items-start gap-3">
                            <div className="min-w-0">
                              {item.product_id ? (
                                <>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {item.product_label}
                                  </p>
                                  {availableStock !== undefined ? (
                                    <p className="mt-1 text-xs text-gray-500">
                                      {availableStock > 0
                                        ? t("salesPage.pos.stockLeft", {
                                            count: availableStock,
                                          })
                                        : t("salesPage.pos.outOfStock")}
                                    </p>
                                  ) : null}
                                  {lineItemErrors[index]?.product_id ? (
                                    <p className="mt-1 text-xs text-[#b45309]">
                                      {lineItemErrors[index]?.product_id}
                                    </p>
                                  ) : null}
                                </>
                              ) : (
                                <AsyncProductSelect
                                  value={item.product_id}
                                  selectedLabel={item.product_label}
                                  onSelect={(product) =>
                                    handleProductSelect(index, product)
                                  }
                                  onSubmitSelection={(product) => {
                                    if (product) {
                                      handleProductSelect(index, product);
                                      window.setTimeout(() => {
                                        quantityInputRefs.current[index]?.focus();
                                        quantityInputRefs.current[index]?.select();
                                      }, 50);
                                    }
                                  }}
                                  placeholder={t("salesPage.pos.productSearchPlaceholder")}
                                  variant="warm"
                                  inputClassName="h-10 rounded-md border-gray-300"
                                />
                              )}
                            </div>

                            <div>
                              <Input
                                ref={(element) => {
                                  quantityInputRefs.current[index] = element;
                                }}
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(event) =>
                                  handleItemChange(index, "quantity", event.target.value)
                                }
                                className="h-10 rounded-md border-gray-300"
                              />
                              {lineItemErrors[index]?.quantity ? (
                                <p className="mt-1 text-xs text-[#b45309]">
                                  {lineItemErrors[index]?.quantity}
                                </p>
                              ) : null}
                            </div>

                            <div>
                              <Input
                                type="number"
                                min="0"
                                value={item.unit_price}
                                onChange={(event) =>
                                  handleItemChange(index, "unit_price", event.target.value)
                                }
                                className="h-10 rounded-md border-gray-300"
                              />
                              {lineItemErrors[index]?.unit_price ? (
                                <p className="mt-1 text-xs text-[#b45309]">
                                  {lineItemErrors[index]?.unit_price}
                                </p>
                              ) : null}
                            </div>

                            <div className="pt-2 text-sm font-semibold text-gray-900">
                              {formatAmount(lineTotal)}
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="mt-1 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-50"
                              aria-label={t("salesPage.lineItems.removeItem")}
                            >
                              x
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {(createSale.isError || serverError) && (
                <p className="text-sm text-[#b45309]">
                  {serverError ?? t("salesPage.messages.saveError")}
                </p>
              )}
            </form>
          </div>

          <aside className="grid gap-5">
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
              <p className="text-sm font-semibold text-gray-900">
                {t("salesPage.pos.summary.title")}
              </p>
              <div className="mt-4 grid gap-3 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>{t("common.subtotal")}</span>
                  <span>{formatAmount(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("common.tax")}</span>
                  <span>{formatAmount(totals.tax)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("common.discount")}</span>
                  <span>{formatAmount(0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-lg font-semibold text-gray-900">
                  <span>{t("common.grandTotal")}</span>
                  <span>{formatAmount(totals.grandTotal)}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="payment_status">
                    {t("salesPage.pos.summary.paymentStatus")}
                  </Label>
                  <select
                    id="payment_status"
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                    value={form.payment_status}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        payment_status: event.target.value,
                        amount_paid:
                          event.target.value === "PARTIALLY_PAID"
                            ? prev.amount_paid
                            : "",
                        payment_date:
                          event.target.value === "UNPAID" ? "" : prev.payment_date || getTodayValue(),
                        payment_method:
                          event.target.value === "UNPAID" ? "" : prev.payment_method || "CASH",
                      }))
                    }
                  >
                    <option value="PAID">{t("salesPage.pos.statuses.paid")}</option>
                    <option value="UNPAID">{t("salesPage.pos.statuses.unpaid")}</option>
                    <option value="PARTIALLY_PAID">{t("salesPage.pos.statuses.partial")}</option>
                  </select>
                </div>

                {form.payment_status === "PARTIALLY_PAID" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="amount_paid">
                      {t("salesPage.pos.summary.paidAmount")}
                    </Label>
                    <Input
                      id="amount_paid"
                      type="number"
                      min="0"
                      value={form.amount_paid}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          amount_paid: event.target.value,
                        }))
                      }
                      className="h-10 rounded-md border-gray-300"
                    />
                  </div>
                ) : null}

                {form.payment_status !== "UNPAID" ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="payment_method">
                        {t("salesPage.pos.summary.paymentMethod")}
                      </Label>
                      <select
                        id="payment_method"
                        className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                        value={form.payment_method}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            payment_method: event.target.value,
                          }))
                        }
                      >
                        <option value="CASH">{t("salesPage.pos.methods.cash")}</option>
                        <option value="UPI">{t("salesPage.pos.methods.upi")}</option>
                        <option value="CARD">{t("salesPage.pos.methods.card")}</option>
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="payment_date">
                        {t("salesPage.pos.summary.paymentDate")}
                      </Label>
                      <Input
                        id="payment_date"
                        type="date"
                        value={form.payment_date}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            payment_date: event.target.value,
                          }))
                        }
                        className="h-10 rounded-md border-gray-300"
                      />
                    </div>
                  </>
                ) : null}

                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>{t("common.paid")}</span>
                    <span>{formatAmount(totals.paidAmount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>{t("common.balance")}</span>
                    <span className="font-medium">{formatAmount(totals.balance)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  form="sales-billing-form"
                  className="h-12 rounded-lg text-base font-semibold"
                  disabled={createSale.isPending || items.length === 0}
                >
                  {t("salesPage.pos.summary.completeSale")}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {t("salesPage.pos.summary.recentTitle")}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {t("salesPage.pos.summary.recentDescription")}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {isLoading ? (
                  <p className="text-sm text-gray-500">{t("salesPage.loading")}</p>
                ) : null}
                {isError ? (
                  <p className="text-sm text-[#b45309]">{t("salesPage.loadError")}</p>
                ) : null}
                {!isLoading && !isError && visibleRecentSales.length === 0 ? (
                  <p className="text-sm text-gray-500">{t("salesPage.empty")}</p>
                ) : null}

                {!isLoading && !isError && visibleRecentSales.length > 0
                  ? visibleRecentSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-3"
                      >
                        {editingId === sale.id ? (
                          <form className="grid gap-3" onSubmit={handleUpdate}>
                            <div className="grid gap-2">
                              <Label>{t("salesPage.fields.status")}</Label>
                              <select
                                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                                value={editingStatus}
                                onChange={(event) => setEditingStatus(event.target.value)}
                              >
                                <option value="DRAFT">{translateSaleStatus("DRAFT")}</option>
                                <option value="COMPLETED">
                                  {translateSaleStatus("COMPLETED")}
                                </option>
                                <option value="VOID">{translateSaleStatus("VOID")}</option>
                              </select>
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("salesPage.fields.paymentStatus")}</Label>
                              <select
                                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                                value={editingPaymentStatus}
                                onChange={(event) =>
                                  setEditingPaymentStatus(event.target.value)
                                }
                              >
                                <option value="UNPAID">
                                  {translatePaymentStatus("UNPAID")}
                                </option>
                                <option value="PARTIALLY_PAID">
                                  {translatePaymentStatus("PARTIALLY_PAID")}
                                </option>
                                <option value="PAID">{translatePaymentStatus("PAID")}</option>
                              </select>
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("salesPage.fields.amountPaid")}</Label>
                              <Input
                                type="number"
                                min="0"
                                value={editingAmountPaid}
                                onChange={(event) =>
                                  setEditingAmountPaid(event.target.value)
                                }
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("salesPage.fields.paymentDate")}</Label>
                              <Input
                                type="date"
                                value={editingPaymentDate}
                                onChange={(event) =>
                                  setEditingPaymentDate(event.target.value)
                                }
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("salesPage.fields.paymentMethod")}</Label>
                              <select
                                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                                value={editingPaymentMethod}
                                onChange={(event) =>
                                  setEditingPaymentMethod(event.target.value)
                                }
                              >
                                <option value="">{t("salesPage.selectMethod")}</option>
                                <option value="CASH">
                                  {translatePaymentMethod("CASH")}
                                </option>
                                <option value="CARD">
                                  {translatePaymentMethod("CARD")}
                                </option>
                                <option value="BANK_TRANSFER">
                                  {translatePaymentMethod("BANK_TRANSFER")}
                                </option>
                                <option value="UPI">{translatePaymentMethod("UPI")}</option>
                                <option value="CHEQUE">
                                  {translatePaymentMethod("CHEQUE")}
                                </option>
                                <option value="OTHER">
                                  {translatePaymentMethod("OTHER")}
                                </option>
                              </select>
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("salesPage.fields.notes")}</Label>
                              <Input
                                value={editingNotes}
                                onChange={(event) =>
                                  setEditingNotes(event.target.value)
                                }
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button type="submit">{t("salesPage.save")}</Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                              >
                                {t("common.cancel")}
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {t("salesPage.invoiceCode", { id: sale.id })}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {formatSaleDate(sale.sale_date)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">
                                {formatAmount(sale.totalAmount)}
                              </p>
                              <span
                                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStatusBadgeClass(
                                  sale.paymentStatus,
                                )}`}
                              >
                                {translatePaymentStatus(sale.paymentStatus)}
                              </span>
                              <div className="mt-2 flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(sale)}
                                >
                                  {t("common.viewDetails")}
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteSale(sale.id)}
                                  disabled={deleteSale.isPending}
                                >
                                  {t("common.delete")}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default SalesClient;
