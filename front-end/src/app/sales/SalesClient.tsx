"use client";

import React, { useMemo, useState } from "react";
import axios from "axios";
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
  useProductsQuery,
  useSalesQuery,
  useUpdateSaleMutation,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";
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
  tax_rate?: string;
};

const SalesClient = ({ name, image }: SalesClientProps) => {
  const { t, formatCurrency, formatDate } = useI18n();
  const { data, isLoading, isError } = useSalesQuery();
  const { data: customers } = useCustomersQuery();
  const { data: products } = useProductsQuery();
  const { data: warehouses } = useWarehousesQuery();
  const createSale = useCreateSaleMutation();
  const updateSale = useUpdateSaleMutation();
  const deleteSale = useDeleteSaleMutation();
  const createCustomer = useCreateCustomerMutation();
  const [form, setForm] = useState({
    customer_id: "",
    warehouse_id: "",
    sale_date: "",
    payment_status: "UNPAID",
    amount_paid: "",
    payment_date: "",
    payment_method: "",
    notes: "",
  });
  const [items, setItems] = useState([
    { product_id: "", quantity: "1", unit_price: "", tax_rate: "" },
  ]);
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

  const formatSaleDate = (value: string) =>
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

  const translateSaleStatus = (status: string) => {
    const key = `salesPage.status.${status}`;
    const translated = t(key);
    return translated === key ? humanizeEnum(status) : translated;
  };

  const paymentStatusBadgeClass = (status: string) => {
    if (status === "PAID") return "bg-emerald-100 text-emerald-700";
    if (status === "PARTIALLY_PAID") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  };

  const sales = useMemo(() => data ?? [], [data]);
  const customerList = customers ?? [];
  const productList = products ?? [];
  const warehouseList = warehouses ?? [];

  const handleItemChange = (
    index: number,
    key: "product_id" | "quantity" | "unit_price" | "tax_rate",
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;

        if (key === "product_id") {
          const selectedProduct = productList.find(
            (product) => String(product.id) === value,
          );

          return {
            ...item,
            product_id: value,
            unit_price: selectedProduct?.price ?? item.unit_price,
          };
        }

        return { ...item, [key]: value };
      }),
    );
    setLineItemSummary([]);
    setLineItemErrors([]);
    setServerError(null);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { product_id: "", quantity: "1", unit_price: "", tax_rate: "" },
    ]);
    setLineItemSummary([]);
    setLineItemErrors([]);
    setServerError(null);
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
    if (customerForm.phone && customerForm.phone.trim().length < 6) {
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
    let invalidTax = false;

    items.forEach((item, index) => {
      if (!item.product_id) {
        errors[index].product_id = t("salesPage.lineItems.errors.product");
        missingProduct = true;
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors[index].quantity = t("salesPage.lineItems.errors.quantity");
        invalidQuantity = true;
      }

      const unitPrice = Number(item.unit_price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        errors[index].unit_price = t("salesPage.lineItems.errors.unitPrice");
        invalidPrice = true;
      }

      if (item.tax_rate) {
        const taxRate = Number(item.tax_rate);
        if (!Number.isFinite(taxRate) || taxRate < 0) {
          errors[index].tax_rate = t("salesPage.lineItems.errors.taxRate");
          invalidTax = true;
        }
      }
    });

    if (missingProduct) summary.push(t("salesPage.lineItems.summary.product"));
    if (invalidQuantity)
      summary.push(t("salesPage.lineItems.summary.quantity"));
    if (invalidPrice)
      summary.push(t("salesPage.lineItems.summary.unitPrice"));
    if (invalidTax)
      summary.push(t("salesPage.lineItems.summary.taxRate"));

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
        amount_paid: form.amount_paid ? Number(form.amount_paid) : undefined,
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
          unit_price: Number(item.unit_price),
          tax_rate: item.tax_rate ? Number(item.tax_rate) : undefined,
        })),
      });
      setForm({
        customer_id: "",
        warehouse_id: "",
        sale_date: "",
        payment_status: "UNPAID",
        amount_paid: "",
        payment_date: "",
        payment_method: "",
        notes: "",
      });
      setItems([
        { product_id: "", quantity: "1", unit_price: "", tax_rate: "" },
      ]);
      setLineItemErrors([]);
      setLineItemSummary([]);
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
        phone: customerForm.phone.trim() || undefined,
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
    const confirmed = window.confirm(
      t("salesPage.messages.deleteConfirm"),
    );
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
      title={t("salesPage.title")}
      subtitle={t("salesPage.subtitle")}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8a6d56]">
            {t("salesPage.kicker")}
          </p>
          <h1 className="text-3xl font-black">{t("salesPage.title")}</h1>
          <p className="max-w-2xl text-base text-[#5c4b3b]">
            {t("salesPage.subtitle")}
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">{t("salesPage.formTitle")}</h2>
            <p className="text-sm text-[#8a6d56]">
              {t("salesPage.formDescription")}
            </p>
            <form className="mt-4 grid gap-4" onSubmit={handleCreate}>
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
                      <Button type="button" variant="outline" size="sm">
                        {t("salesPage.customer.quickAdd")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("salesPage.customer.addTitle")}</DialogTitle>
                        <DialogDescription>
                          {t("salesPage.customer.addDescription")}
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        className="grid gap-3"
                        onSubmit={handleCreateCustomer}
                      >
                        <div className="grid gap-2">
                          <Label htmlFor="customer_name">{t("salesPage.customer.fields.name")}</Label>
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
                          {customerFieldErrors.name && (
                            <p className="text-xs text-[#b45309]">
                              {customerFieldErrors.name}
                            </p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="customer_email">{t("salesPage.customer.fields.email")}</Label>
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
                          {customerFieldErrors.email && (
                            <p className="text-xs text-[#b45309]">
                              {customerFieldErrors.email}
                            </p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="customer_phone">{t("salesPage.customer.fields.phone")}</Label>
                          <Input
                            id="customer_phone"
                            value={customerForm.phone}
                            onChange={(event) => {
                              setCustomerForm((prev) => ({
                                ...prev,
                                phone: event.target.value,
                              }));
                              setCustomerFieldErrors((prev) => ({
                                ...prev,
                                phone: undefined,
                              }));
                              setCustomerError(null);
                            }}
                          />
                          {customerFieldErrors.phone && (
                            <p className="text-xs text-[#b45309]">
                              {customerFieldErrors.phone}
                            </p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="customer_address">{t("salesPage.customer.fields.address")}</Label>
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
                        {customerError && (
                          <p className="text-xs text-[#b45309]">
                            {customerError}
                          </p>
                        )}
                        {createCustomer.isError && (
                          <p className="text-xs text-[#b45309]">
                            {t("salesPage.messages.createCustomerError")}
                          </p>
                        )}
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
                  className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                  value={form.customer_id}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      customer_id: event.target.value,
                    }))
                  }
                  onBlur={() => setServerError(null)}
                >
                  <option value="">{t("salesPage.customer.walkIn")}</option>
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
                  className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                  value={form.warehouse_id}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      warehouse_id: event.target.value,
                    }))
                  }
                  onBlur={() => setServerError(null)}
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
                <Label htmlFor="sale_date">{t("salesPage.fields.saleDate")}</Label>
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
                  onBlur={() => setServerError(null)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">{t("salesPage.fields.notes")}</Label>
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  onBlur={() => setServerError(null)}
                  placeholder={t("salesPage.placeholders.notes")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment_status">{t("salesPage.fields.paymentStatus")}</Label>
                <select
                  id="payment_status"
                  className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                  value={form.payment_status}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      payment_status: event.target.value,
                    }))
                  }
                >
                  <option value="UNPAID">{translatePaymentStatus("UNPAID")}</option>
                  <option value="PARTIALLY_PAID">{translatePaymentStatus("PARTIALLY_PAID")}</option>
                  <option value="PAID">{translatePaymentStatus("PAID")}</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount_paid">{t("salesPage.fields.amountPaid")}</Label>
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
                  placeholder={t("salesPage.placeholders.amountPaid")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment_date">{t("salesPage.fields.paymentDate")}</Label>
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
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment_method">{t("salesPage.fields.paymentMethod")}</Label>
                <select
                  id="payment_method"
                  className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                  value={form.payment_method}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      payment_method: event.target.value,
                    }))
                  }
                >
                  <option value="">{t("salesPage.selectMethod")}</option>
                  <option value="CASH">{translatePaymentMethod("CASH")}</option>
                  <option value="CARD">{translatePaymentMethod("CARD")}</option>
                  <option value="BANK_TRANSFER">{translatePaymentMethod("BANK_TRANSFER")}</option>
                  <option value="UPI">{translatePaymentMethod("UPI")}</option>
                  <option value="CHEQUE">{translatePaymentMethod("CHEQUE")}</option>
                  <option value="OTHER">{translatePaymentMethod("OTHER")}</option>
                </select>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label>{t("salesPage.lineItems.title")}</Label>
                  <Button type="button" variant="outline" onClick={addItem}>
                    {t("salesPage.lineItems.addItem")}
                  </Button>
                </div>
                {lineItemSummary.length > 0 && (
                  <div className="rounded-xl border border-[#f2e6dc] bg-white px-3 py-2 text-xs text-[#b45309]">
                    <p className="font-semibold">{t("salesPage.lineItems.fixTitle")}</p>
                    <ul className="mt-1 list-disc pl-4">
                      {lineItemSummary.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {items.map((item, index) => (
                  <div
                    key={`sale-item-${index}`}
                    className="grid gap-3 rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3"
                  >
                    <div className="grid gap-2">
                      <Label>{t("salesPage.lineItems.fields.product")}</Label>
                      <select
                        className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                        value={item.product_id}
                        onChange={(event) =>
                          handleItemChange(
                            index,
                            "product_id",
                            event.target.value,
                          )
                        }
                        required
                      >
                        <option value="">{t("salesPage.lineItems.selectProduct")}</option>
                        {productList.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - {product.sku}
                          </option>
                        ))}
                      </select>
                      {lineItemErrors[index]?.product_id && (
                        <p className="text-xs text-[#b45309]">
                          {lineItemErrors[index]?.product_id}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("salesPage.lineItems.fields.quantity")}</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(event) =>
                          handleItemChange(
                            index,
                            "quantity",
                            event.target.value,
                          )
                        }
                        required
                      />
                      {lineItemErrors[index]?.quantity && (
                        <p className="text-xs text-[#b45309]">
                          {lineItemErrors[index]?.quantity}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("salesPage.lineItems.fields.unitPrice")}</Label>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(event) =>
                          handleItemChange(
                            index,
                            "unit_price",
                            event.target.value,
                          )
                        }
                        required
                      />
                      {lineItemErrors[index]?.unit_price && (
                        <p className="text-xs text-[#b45309]">
                          {lineItemErrors[index]?.unit_price}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("salesPage.lineItems.fields.taxRate")}</Label>
                      <Input
                        type="number"
                        value={item.tax_rate}
                        onChange={(event) =>
                          handleItemChange(
                            index,
                            "tax_rate",
                            event.target.value,
                          )
                        }
                        placeholder={t("salesPage.optional")}
                      />
                      {lineItemErrors[index]?.tax_rate && (
                        <p className="text-xs text-[#b45309]">
                          {lineItemErrors[index]?.tax_rate}
                        </p>
                      )}
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => removeItem(index)}
                      >
                        {t("salesPage.lineItems.removeItem")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                disabled={createSale.isPending}
              >
                {t("salesPage.saveSale")}
              </Button>
              {(createSale.isError || serverError) && (
                <p className="text-sm text-[#b45309]">
                  {serverError ?? t("salesPage.messages.saveError")}
                </p>
              )}
            </form>
          </div>

          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">{t("salesPage.recentTitle")}</h2>
            <p className="text-sm text-[#8a6d56]">
              {t("salesPage.recentDescription")}
            </p>
            <div className="mt-4">
              {isLoading && (
                <p className="text-sm text-[#8a6d56]">{t("salesPage.loading")}</p>
              )}
              {isError && (
                <p className="text-sm text-[#b45309]">{t("salesPage.loadError")}</p>
              )}
              {!isLoading && !isError && sales.length === 0 && (
                <p className="text-sm text-[#8a6d56]">{t("salesPage.empty")}</p>
              )}
              {!isLoading && !isError && sales.length > 0 && (
                <div className="grid gap-3">
                  {sales.map((sale) => (
                    <div
                      key={sale.id}
                      className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-3"
                    >
                      {editingId === sale.id ? (
                        <form className="grid gap-3" onSubmit={handleUpdate}>
                          <div className="grid gap-2">
                            <Label>{t("salesPage.fields.status")}</Label>
                            <select
                              className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                              value={editingStatus}
                              onChange={(event) =>
                                setEditingStatus(event.target.value)
                              }
                            >
                              <option value="DRAFT">{translateSaleStatus("DRAFT")}</option>
                              <option value="COMPLETED">{translateSaleStatus("COMPLETED")}</option>
                              <option value="VOID">{translateSaleStatus("VOID")}</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>{t("salesPage.fields.paymentStatus")}</Label>
                            <select
                              className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                              value={editingPaymentStatus}
                              onChange={(event) =>
                                setEditingPaymentStatus(event.target.value)
                              }
                            >
                              <option value="UNPAID">{translatePaymentStatus("UNPAID")}</option>
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
                              className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                              value={editingPaymentMethod}
                              onChange={(event) =>
                                setEditingPaymentMethod(event.target.value)
                              }
                            >
                              <option value="">{t("salesPage.selectMethod")}</option>
                              <option value="CASH">{translatePaymentMethod("CASH")}</option>
                              <option value="CARD">{translatePaymentMethod("CARD")}</option>
                              <option value="BANK_TRANSFER">
                                {translatePaymentMethod("BANK_TRANSFER")}
                              </option>
                              <option value="UPI">{translatePaymentMethod("UPI")}</option>
                              <option value="CHEQUE">{translatePaymentMethod("CHEQUE")}</option>
                              <option value="OTHER">{translatePaymentMethod("OTHER")}</option>
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
                            <Button
                              type="submit"
                              className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                            >
                              {t("salesPage.save")}
                            </Button>
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
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold">
                              {t("salesPage.invoiceCode", { id: sale.id })} - {sale.customer?.name ?? t("salesPage.customer.walkIn")}
                            </p>
                            <p className="text-xs text-[#8a6d56]">
                              {formatSaleDate(sale.sale_date)} - {t("salesPage.itemsCount", {
                                count: sale.items.length,
                              })}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-[#5c4b3b]">
                            <span>{translateSaleStatus(sale.status)}</span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStatusBadgeClass(
                                sale.paymentStatus,
                              )}`}
                            >
                              {translatePaymentStatus(sale.paymentStatus)}
                            </span>
                            <span>
                              {t("salesPage.totals.total", {
                                amount: formatAmount(sale.totalAmount),
                              })}
                            </span>
                            <span>
                              {t("salesPage.totals.paid", {
                                amount: formatAmount(sale.paidAmount),
                              })}
                            </span>
                            <span>
                              {t("salesPage.totals.pending", {
                                amount: formatAmount(sale.pendingAmount),
                              })}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleEdit(sale)}
                            >
                              {t("salesPage.edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => handleDeleteSale(sale.id)}
                              disabled={deleteSale.isPending}
                            >
                              {t("common.delete")}
                            </Button>
                          </div>
                        </div>
                      )}
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

export default SalesClient;
