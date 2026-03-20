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
import { ValidationField } from "@/components/ui/ValidationField";
import {
  validateName,
  validateEmail,
  validatePhone,
  validateRequired,
  validateNumber,
  validateDropdown,
  validateDate,
} from "@/lib/validation";
import { Label } from "@/components/ui/label";
import {
  useCreatePurchaseMutation,
  useCreateSupplierMutation,
  useProductsQuery,
  usePurchasesQuery,
  useSuppliersQuery,
  useUpdatePurchaseMutation,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";
import { useI18n } from "@/providers/LanguageProvider";

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

const PurchasesClient = ({ name, image }: PurchasesClientProps) => {
  const { t, formatCurrency, formatDate } = useI18n();
  const { data, isLoading, isError } = usePurchasesQuery();
  const { data: products } = useProductsQuery();
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
  const [items, setItems] = useState([
    { product_id: "", quantity: "1", unit_cost: "", tax_rate: "" },
  ]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [lineItemErrors, setLineItemErrors] = useState<PurchaseLineItemError[]>(
    [],
  );
  const [lineItemSummary, setLineItemSummary] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [supplierFieldErrors, setSupplierFieldErrors] = useState<
    Partial<Record<keyof typeof supplierForm, string>>
  >({});
  const [supplierError, setSupplierError] = useState<string | null>(null);

  const translateValidationMessage = (message: string) => {
    switch (message) {
      case "This field is required":
        return t("validation.required");
      case "Please enter a valid name (letters only)":
        return t("validation.validName");
      case "Enter a valid email address":
        return t("validation.validEmail");
      case "Enter a valid phone number":
        return t("validation.validPhone");
      case "Enter a valid number":
        return t("validation.validNumber");
      case "Select a valid date":
        return t("validation.validDate");
      case "Please select an option":
        return t("common.selectOption");
      default:
        return message;
    }
  };

  const withTranslatedValidation =
    (validator: (value: string) => string) => (value: string) =>
      translateValidationMessage(validator(value));

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
  const productsList = products ?? [];
  const supplierList = suppliers ?? [];
  const warehouseList = warehouses ?? [];

  const handleItemChange = (
    index: number,
    key: "product_id" | "quantity" | "unit_cost" | "tax_rate",
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;

        if (key === "product_id") {
          const selectedProduct = productsList.find(
            (product) => String(product.id) === value,
          );

          return {
            ...item,
            product_id: value,
            unit_cost:
              selectedProduct?.cost ?? selectedProduct?.price ?? item.unit_cost,
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
      { product_id: "", quantity: "1", unit_cost: "", tax_rate: "" },
    ]);
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
    setItems([{ product_id: "", quantity: "1", unit_cost: "", tax_rate: "" }]);
    setEditingId(null);
    setLineItemErrors([]);
    setLineItemSummary([]);
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
          values.forEach((value) => messages.add(value));
        });
      }
      if (messages.size) return Array.from(messages).join(" ");
    }
    return fallback;
  };

  const validateSupplierForm = () => {
    const errors: Partial<Record<keyof typeof supplierForm, string>> = {};
    if (supplierForm.name.trim().length < 2) {
      errors.name = t("purchasesPage.supplierForm.errors.name");
    }
    if (supplierForm.email && !/\S+@\S+\.\S+/.test(supplierForm.email)) {
      errors.email = t("validation.validEmail");
    }
    if (supplierForm.phone && supplierForm.phone.trim().length < 6) {
      errors.phone = t("purchasesPage.supplierForm.errors.phone");
    }

    setSupplierFieldErrors(errors);
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

    if (missingProduct) summary.push(t("purchasesPage.lineItems.summary.product"));
    if (invalidQuantity)
      summary.push(t("purchasesPage.lineItems.summary.quantity"));
    if (invalidCost)
      summary.push(t("purchasesPage.lineItems.summary.unitCost"));
    if (invalidTax)
      summary.push(t("purchasesPage.lineItems.summary.taxRate"));

    setLineItemErrors(errors);
    setLineItemSummary(summary);
    return summary.length === 0;
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
        quantity: String(item.quantity),
        unit_cost: String(item.unit_cost),
        tax_rate: item.tax_rate ? String(item.tax_rate) : "",
      })),
    );
    setLineItemErrors([]);
    setLineItemSummary([]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateItems()) return;
    setServerError(null);

    const payload = {
      supplier_id: form.supplier_id ? Number(form.supplier_id) : undefined,
      warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
      purchase_date: form.purchase_date || undefined,
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

      resetForm();
    } catch (error) {
      setServerError(
        parseServerErrors(error, t("purchasesPage.saveError")),
      );
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
        phone: supplierForm.phone.trim() || undefined,
        address: supplierForm.address.trim() || undefined,
      });

      setSupplierDialogOpen(false);
      setSupplierForm({ name: "", email: "", phone: "", address: "" });
      setSupplierFieldErrors({});
      setForm((prev) => ({ ...prev, supplier_id: String(created.id) }));
    } catch (error) {
      setSupplierError(
        parseServerErrors(error, t("purchasesPage.supplierForm.saveError")),
      );
    }
  };

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

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
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
                  <Label htmlFor="supplier">
                    {t("purchasesPage.fields.supplier")}
                  </Label>
                  {/* ...existing code for Dialog (Quick add) remains unchanged... */}
                </div>
                <ValidationField
                  id="supplier"
                  label={t("purchasesPage.fields.supplier")}
                  as="select"
                  value={form.supplier_id}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, supplier_id: value }))
                  }
                  validate={(value) =>
                    value ? "" : t("purchasesPage.validation.selectSupplier")
                  }
                  required
                  success
                >
                  <option value="">{t("purchasesPage.directPurchase")}</option>
                  {supplierList.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </ValidationField>
              </div>
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
              <ValidationField
                id="payment_status"
                label={t("purchasesPage.fields.paymentStatus")}
                as="select"
                value={form.payment_status}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, payment_status: value }))
                }
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
              <ValidationField
                id="amount_paid"
                label={t("purchasesPage.fields.amountPaid")}
                type="number"
                value={form.amount_paid}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, amount_paid: value }))
                }
                validate={(value) =>
                  value
                    ? translateValidationMessage(validateNumber(value))
                    : ""
                }
                placeholder={t("purchasesPage.placeholders.amountPaid")}
                success
              />
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
              <ValidationField
                id="payment_method"
                label={t("purchasesPage.fields.paymentMethod")}
                as="select"
                value={form.payment_method}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, payment_method: value }))
                }
                validate={withTranslatedValidation(validateRequired)}
                required
                success
              >
                <option value="">{t("purchasesPage.selectMethod")}</option>
                <option value="CASH">{translatePaymentMethod("CASH")}</option>
                <option value="CARD">{translatePaymentMethod("CARD")}</option>
                <option value="BANK_TRANSFER">
                  {translatePaymentMethod("BANK_TRANSFER")}
                </option>
                <option value="UPI">{translatePaymentMethod("UPI")}</option>
                <option value="CHEQUE">{translatePaymentMethod("CHEQUE")}</option>
                <option value="OTHER">{translatePaymentMethod("OTHER")}</option>
              </ValidationField>

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
                    className="grid gap-3 rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3"
                  >
                    <div className="grid gap-2">
                      <Label>{t("purchasesPage.lineItems.fields.product")}</Label>
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
                        <option value="">
                          {t("purchasesPage.lineItems.selectProduct")}
                        </option>
                        {productsList.map((product) => (
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
                      <Label>{t("purchasesPage.lineItems.fields.quantity")}</Label>
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
                      <Label>{t("purchasesPage.lineItems.fields.unitCost")}</Label>
                      <Input
                        type="number"
                        value={item.unit_cost}
                        onChange={(event) =>
                          handleItemChange(
                            index,
                            "unit_cost",
                            event.target.value,
                          )
                        }
                        required
                      />
                      {lineItemErrors[index]?.unit_cost && (
                        <p className="text-xs text-[#b45309]">
                          {lineItemErrors[index]?.unit_cost}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("purchasesPage.lineItems.fields.taxRate")}</Label>
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
                        placeholder={t("purchasesPage.optional")}
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
                        {t("purchasesPage.lineItems.removeItem")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                disabled={createPurchase.isPending || updatePurchase.isPending}
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
            </form>
          </div>

          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
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
                          {t("purchasesPage.purchaseCode", { id: purchase.id })} -{" "}
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
