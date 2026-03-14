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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));

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
      errors.name = "Customer name must be at least 2 characters.";
    }
    if (customerForm.email && !/\S+@\S+\.\S+/.test(customerForm.email)) {
      errors.email = "Enter a valid email address.";
    }
    if (customerForm.phone && customerForm.phone.trim().length < 6) {
      errors.phone = "Phone number should be at least 6 characters.";
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
        errors[index].product_id = "Select a product.";
        missingProduct = true;
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors[index].quantity = "Quantity must be greater than 0.";
        invalidQuantity = true;
      }

      const unitPrice = Number(item.unit_price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        errors[index].unit_price = "Unit price must be greater than 0.";
        invalidPrice = true;
      }

      if (item.tax_rate) {
        const taxRate = Number(item.tax_rate);
        if (!Number.isFinite(taxRate) || taxRate < 0) {
          errors[index].tax_rate = "Tax rate must be 0 or higher.";
          invalidTax = true;
        }
      }
    });

    if (missingProduct) summary.push("Select a product for each line item.");
    if (invalidQuantity)
      summary.push("Ensure quantities are valid numbers greater than 0.");
    if (invalidPrice)
      summary.push("Enter a valid unit price greater than 0 for each item.");
    if (invalidTax)
      summary.push("Tax rates must be 0 or higher when provided.");

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
        parseServerErrors(error, "Unable to save sale right now."),
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
        parseServerErrors(error, "Unable to create customer right now."),
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
        parseServerErrors(error, "Unable to update sale right now."),
      );
    }
  };

  const handleDeleteSale = async (saleId: number) => {
    const confirmed = window.confirm(
      "Delete this sale? Product stock will be restored.",
    );
    if (!confirmed) return;

    try {
      await deleteSale.mutateAsync(saleId);
      setServerError(null);
    } catch (error) {
      setServerError(
        parseServerErrors(error, "Unable to delete sale right now."),
      );
    }
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title="Sales"
      subtitle="Track outgoing invoices and realized revenue."
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8a6d56]">
            Billing
          </p>
          <h1 className="text-3xl font-black">Sales</h1>
          <p className="max-w-2xl text-base text-[#5c4b3b]">
            Track outgoing invoices and realized revenue.
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">Create sale</h2>
            <p className="text-sm text-[#8a6d56]">
              Record customer invoices and outgoing stock.
            </p>
            <form className="mt-4 grid gap-4" onSubmit={handleCreate}>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="customer">Customer</Label>
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
                        Quick add
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add customer</DialogTitle>
                        <DialogDescription>
                          Create a customer without leaving this screen.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        className="grid gap-3"
                        onSubmit={handleCreateCustomer}
                      >
                        <div className="grid gap-2">
                          <Label htmlFor="customer_name">Name</Label>
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
                          <Label htmlFor="customer_email">Email</Label>
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
                          <Label htmlFor="customer_phone">Phone</Label>
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
                          <Label htmlFor="customer_address">Address</Label>
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
                            Unable to create customer right now.
                          </p>
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCustomerDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit">Save customer</Button>
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
                  <option value="">Walk-in customer</option>
                  {customerList.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="warehouse">Warehouse</Label>
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
                  <option value="">Default stock</option>
                  {warehouseList.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sale_date">Sale date</Label>
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
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  onBlur={() => setServerError(null)}
                  placeholder="Invoice reference"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment_status">Payment status</Label>
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
                  <option value="UNPAID">UNPAID</option>
                  <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                  <option value="PAID">PAID</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount_paid">Paid amount</Label>
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
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment_date">Payment date</Label>
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
                <Label htmlFor="payment_method">Payment method</Label>
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
                  <option value="">Select method</option>
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">CHEQUE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label>Line items</Label>
                  <Button type="button" variant="outline" onClick={addItem}>
                    Add item
                  </Button>
                </div>
                {lineItemSummary.length > 0 && (
                  <div className="rounded-xl border border-[#f2e6dc] bg-white px-3 py-2 text-xs text-[#b45309]">
                    <p className="font-semibold">Fix the following:</p>
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
                      <Label>Product</Label>
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
                        <option value="">Select product</option>
                        {productList.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} • {product.sku}
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
                      <Label>Quantity</Label>
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
                      <Label>Unit price</Label>
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
                      <Label>Tax rate</Label>
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
                        placeholder="Optional"
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
                        Remove item
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
                Save sale
              </Button>
              {(createSale.isError || serverError) && (
                <p className="text-sm text-[#b45309]">
                  {serverError ?? "Unable to save sale right now."}
                </p>
              )}
            </form>
          </div>

          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">Recent sales</h2>
            <p className="text-sm text-[#8a6d56]">
              Update status and track settled invoices.
            </p>
            <div className="mt-4">
              {isLoading && (
                <p className="text-sm text-[#8a6d56]">Loading sales...</p>
              )}
              {isError && (
                <p className="text-sm text-[#b45309]">Failed to load sales.</p>
              )}
              {!isLoading && !isError && sales.length === 0 && (
                <p className="text-sm text-[#8a6d56]">No sales yet.</p>
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
                            <Label>Status</Label>
                            <select
                              className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                              value={editingStatus}
                              onChange={(event) =>
                                setEditingStatus(event.target.value)
                              }
                            >
                              <option value="DRAFT">DRAFT</option>
                              <option value="COMPLETED">COMPLETED</option>
                              <option value="VOID">VOID</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Payment status</Label>
                            <select
                              className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                              value={editingPaymentStatus}
                              onChange={(event) =>
                                setEditingPaymentStatus(event.target.value)
                              }
                            >
                              <option value="UNPAID">UNPAID</option>
                              <option value="PARTIALLY_PAID">
                                PARTIALLY PAID
                              </option>
                              <option value="PAID">PAID</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Paid amount</Label>
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
                            <Label>Payment date</Label>
                            <Input
                              type="date"
                              value={editingPaymentDate}
                              onChange={(event) =>
                                setEditingPaymentDate(event.target.value)
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Payment method</Label>
                            <select
                              className="h-9 w-full rounded-md border border-[#e4d6ca] bg-white px-3 text-sm"
                              value={editingPaymentMethod}
                              onChange={(event) =>
                                setEditingPaymentMethod(event.target.value)
                              }
                            >
                              <option value="">Select method</option>
                              <option value="CASH">CASH</option>
                              <option value="CARD">CARD</option>
                              <option value="BANK_TRANSFER">
                                BANK TRANSFER
                              </option>
                              <option value="UPI">UPI</option>
                              <option value="CHEQUE">CHEQUE</option>
                              <option value="OTHER">OTHER</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Notes</Label>
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
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold">
                              INV-{sale.id} • {sale.customer?.name ?? "Walk-in"}
                            </p>
                            <p className="text-xs text-[#8a6d56]">
                              {formatDate(sale.sale_date)} • Items:{" "}
                              {sale.items.length}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-[#5c4b3b]">
                            <span>{sale.status}</span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStatusBadgeClass(
                                sale.paymentStatus,
                              )}`}
                            >
                              {sale.paymentStatus.replace("_", " ")}
                            </span>
                            <span>
                              Total ₹{Number(sale.totalAmount).toFixed(2)}
                            </span>
                            <span>
                              Paid ₹{Number(sale.paidAmount).toFixed(2)}
                            </span>
                            <span>
                              Pending ₹{Number(sale.pendingAmount).toFixed(2)}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleEdit(sale)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => handleDeleteSale(sale.id)}
                              disabled={deleteSale.isPending}
                            >
                              Delete
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
