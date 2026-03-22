"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  Phone,
  Printer,
  Search,
  Share2,
  SquarePen,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DataExportDialog from "@/components/export/DataExportDialog";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Customer, CustomerLedger } from "@/lib/apiClient";
import {
  useCreateCustomerMutation,
  useCreatePaymentMutation,
  useCustomerLedgerQuery,
  useCustomersQuery,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from "@/hooks/useInventoryQueries";
import { useI18n } from "@/providers/LanguageProvider";

type CustomersClientProps = {
  name: string;
  image?: string;
};

type CustomerFormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

const emptyForm: CustomerFormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

const validateCustomerForm = (form: CustomerFormState) => {
  const errors: Partial<Record<keyof CustomerFormState, string>> = {};

  if (!form.name.trim()) {
    errors.name = "Enter a customer name.";
  } else if (form.name.trim().length < 2) {
    errors.name = "Customer name should be at least 2 characters.";
  }

  if (!form.phone.trim()) {
    errors.phone = "Enter a phone number.";
  } else if (!/^\d{10,15}$/.test(form.phone.trim())) {
    errors.phone = "Phone number should contain 10 to 15 digits.";
  }

  if (
    form.email.trim() &&
    !/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(form.email.trim())
  ) {
    errors.email = "Enter a valid email address or leave it blank.";
  }

  return errors;
};

const formatActivityDate = (
  value: string | null | undefined,
  formatDate: ReturnType<typeof useI18n>["formatDate"],
) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatDate(parsed, { day: "numeric", month: "short", year: "numeric" });
};

const buildStatementHtml = ({
  customer,
  ledger,
  formatCurrency,
  formatDate,
}: {
  customer: Customer;
  ledger: CustomerLedger;
  formatCurrency: ReturnType<typeof useI18n>["formatCurrency"];
  formatDate: ReturnType<typeof useI18n>["formatDate"];
}) => {
  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const rows = ledger.entries
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(formatActivityDate(entry.date, formatDate))}</td>
          <td>${escapeHtml(entry.description)}</td>
          <td>${escapeHtml(entry.note ?? "-")}</td>
          <td>${escapeHtml(formatCurrency(entry.debit, "INR"))}</td>
          <td>${escapeHtml(formatCurrency(entry.credit, "INR"))}</td>
          <td>${escapeHtml(formatCurrency(entry.balance, "INR"))}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <html>
      <head>
        <title>${escapeHtml(customer.name)} Ledger Statement</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #1f1b16; }
          h1, h2, p { margin: 0; }
          .meta { margin-top: 8px; color: #5f5a55; }
          .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
          .card { border: 1px solid #e7ded1; border-radius: 16px; padding: 16px; background: #fcfaf6; }
          .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #8a6b45; }
          .value { margin-top: 8px; font-size: 22px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
          th, td { border: 1px solid #ece4d8; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #f8f2e8; }
        </style>
      </head>
      <body>
        <p class="label">Customer ledger statement</p>
        <h1 style="margin-top: 8px;">${escapeHtml(customer.name)}</h1>
        <p class="meta">${escapeHtml(customer.phone ?? "-")} | ${escapeHtml(customer.address ?? "No address")}</p>
        <p class="meta">Generated on ${escapeHtml(formatDate(new Date(), { day: "numeric", month: "short", year: "numeric" }))}</p>
        <div class="summary">
          <div class="card"><p class="label">Total due</p><p class="value">${escapeHtml(formatCurrency(ledger.summary.outstandingBalance, "INR"))}</p></div>
          <div class="card"><p class="label">Total billed</p><p class="value">${escapeHtml(formatCurrency(ledger.summary.totalBilled, "INR"))}</p></div>
          <div class="card"><p class="label">Total paid</p><p class="value">${escapeHtml(formatCurrency(ledger.summary.totalPaid, "INR"))}</p></div>
        </div>
        <table>
          <thead>
            <tr><th>Date</th><th>Description</th><th>Note</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
};

const CustomersClient = ({ name, image }: CustomersClientProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatCurrency, formatDate } = useI18n();
  const { data, isLoading, isError } = useCustomersQuery();
  const createCustomer = useCreateCustomerMutation();
  const updateCustomer = useUpdateCustomerMutation();
  const deleteCustomer = useDeleteCustomerMutation();
  const createPayment = useCreatePaymentMutation();

  const customers = useMemo(() => data ?? [], [data]);
  const [query, setQuery] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerFormState, string>>>({});
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const ordered = [...customers].sort((left, right) => {
      const leftTime = new Date(left.lastActivityDate ?? left.lastPaymentDate ?? "").getTime();
      const rightTime = new Date(right.lastActivityDate ?? right.lastPaymentDate ?? "").getTime();
      return rightTime - leftTime;
    });

    if (!normalized) return ordered;

    return ordered.filter((customer) =>
      [customer.name, customer.phone, customer.email, customer.address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [customers, query]);

  const recentCustomers = useMemo(() => filteredCustomers.slice(0, 5), [filteredCustomers]);

  useEffect(() => {
    const paramId = Number(searchParams.get("customer"));
    if (Number.isFinite(paramId) && customers.some((customer) => customer.id === paramId)) {
      setSelectedCustomerId(paramId);
      return;
    }

    if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }

    if (customers.length === 0) {
      setSelectedCustomerId(null);
    }
  }, [customers, searchParams, selectedCustomerId]);

  const selectCustomer = (customerId: number) => {
    setSelectedCustomerId(customerId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("customer", String(customerId));
    router.replace(`/customers?${params.toString()}`, { scroll: false });
  };

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const { data: ledger, isLoading: ledgerLoading } = useCustomerLedgerQuery(
    selectedCustomerId ?? undefined,
  );

  const summaryCards = useMemo(() => {
    const totalOutstanding = customers.reduce(
      (sum, customer) => sum + (customer.outstandingBalance ?? 0),
      0,
    );
    const customersWithDue = customers.filter(
      (customer) => (customer.outstandingBalance ?? 0) > 0,
    ).length;
    const settledCustomers = customers.filter(
      (customer) => (customer.outstandingBalance ?? 0) <= 0,
    ).length;

    return [
      {
        label: "Total outstanding",
        value: formatCurrency(totalOutstanding, "INR"),
        tone: "border-amber-200 bg-amber-50 text-amber-950",
        icon: Wallet,
      },
      {
        label: "Customers with due",
        value: String(customersWithDue),
        tone: "border-rose-200 bg-rose-50 text-rose-950",
        icon: AlertCircle,
      },
      {
        label: "Settled accounts",
        value: String(settledCustomers),
        tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
        icon: CheckCircle2,
      },
    ];
  }, [customers, formatCurrency]);

  const resetForm = () => {
    setForm(emptyForm);
    setFormErrors({});
    setFormMode("create");
  };

  const startEditing = (customer: Customer) => {
    setFormMode("edit");
    selectCustomer(customer.id);
    setForm({
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
    });
    setFormErrors({});
  };

  const handleSaveCustomer = async (event: React.FormEvent) => {
    event.preventDefault();

    const errors = validateCustomerForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
    };

    try {
      if (formMode === "edit" && selectedCustomerId) {
        await updateCustomer.mutateAsync({
          id: selectedCustomerId,
          payload,
        });
        toast.success("Customer updated.");
      } else {
        const created = await createCustomer.mutateAsync(payload);
        toast.success("Customer added.");
        selectCustomer(created.id);
      }
      resetForm();
    } catch {
      toast.error("Unable to save customer right now.");
    }
  };

  const handleDeleteCustomer = async (customerId: number) => {
    try {
      await deleteCustomer.mutateAsync(customerId);
      toast.success("Customer removed.");
      if (selectedCustomerId === customerId) {
        const nextCustomer = customers.find((customer) => customer.id !== customerId);
        if (nextCustomer) {
          selectCustomer(nextCustomer.id);
        } else {
          setSelectedCustomerId(null);
          router.replace("/customers", { scroll: false });
        }
      }
    } catch {
      toast.error("Unable to remove customer right now.");
    }
  };

  const toggleCustomerSelection = (customerId: number) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId],
    );
  };

  const openPaymentModal = () => {
    if (!ledger || ledger.summary.openInvoices.length === 0) {
      toast.error("This customer does not have any pending invoices.");
      return;
    }

    const nextInvoice = ledger.summary.openInvoices[0];
    setPaymentInvoiceId(String(nextInvoice.id));
    setPaymentAmount(String(nextInvoice.remaining));
    setPaymentError(null);
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!ledger) return;

    const invoiceId = Number(paymentInvoiceId);
    const amount = Number(paymentAmount);
    const targetInvoice = ledger.summary.openInvoices.find(
      (invoice) => invoice.id === invoiceId,
    );

    if (!targetInvoice) {
      setPaymentError("Select an invoice to record payment against.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a valid payment amount.");
      return;
    }

    if (amount > targetInvoice.remaining) {
      setPaymentError(
        `Payment cannot exceed ${formatCurrency(targetInvoice.remaining, "INR")}.`,
      );
      return;
    }

    try {
      await createPayment.mutateAsync({
        invoice_id: invoiceId,
        amount,
        paid_at: new Date().toISOString(),
      });
      toast.success("Payment recorded in the customer ledger.");
      setPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentInvoiceId("");
      setPaymentError(null);
    } catch {
      setPaymentError("Unable to record payment right now.");
    }
  };

  const handlePrintStatement = () => {
    if (!selectedCustomer || !ledger || typeof window === "undefined") return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast.error("Unable to open the statement window.");
      return;
    }

    printWindow.document.write(
      buildStatementHtml({
        customer: selectedCustomer,
        ledger,
        formatCurrency,
        formatDate,
      }),
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleShareStatement = async () => {
    if (!selectedCustomer || !ledger) return;

    const shareText = [
      `${selectedCustomer.name} ledger summary`,
      `Outstanding: ${formatCurrency(ledger.summary.outstandingBalance, "INR")}`,
      `Last payment: ${formatActivityDate(ledger.summary.lastPaymentDate, formatDate)}`,
    ].join("\n");

    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/customers?customer=${selectedCustomer.id}`
        : undefined;

    try {
      if (
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        shareUrl
      ) {
        await navigator.share({
          title: `${selectedCustomer.name} ledger`,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(
          shareUrl ? `${shareText}\n${shareUrl}` : shareText,
        );
        toast.success("Statement summary copied.");
        return;
      }

      toast.success(shareText);
    } catch {
      toast.error("Unable to share the statement right now.");
    }
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title="Customer khata"
      subtitle="Track customer balances, udhaar, and payment history in one modern ledger."
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <div key={card.label} className={cn("rounded-[1.6rem] border px-5 py-5", card.tone)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{card.label}</p>
                  <Icon className="size-4" />
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight">{card.value}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="grid gap-6">
            <section className="app-panel rounded-[1.9rem] p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">Customer management</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">
                    {formMode === "edit" ? "Edit customer" : "Add customer"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Keep names and phone numbers clean so billing and collection follow-up stay fast.
                  </p>
                </div>
                {formMode === "edit" ? (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
              </div>

              <form className="mt-5 grid gap-4" onSubmit={handleSaveCustomer} noValidate>
                <div className="grid gap-2">
                  <Label htmlFor="customer-name">Name</Label>
                  <Input
                    id="customer-name"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Customer name"
                  />
                  {formErrors.name ? <p className="text-xs text-amber-700">{formErrors.name}</p> : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customer-phone">Phone</Label>
                  <Input
                    id="customer-phone"
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="10 digit phone number"
                    inputMode="numeric"
                  />
                  {formErrors.phone ? <p className="text-xs text-amber-700">{formErrors.phone}</p> : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customer-email">Email (optional)</Label>
                  <Input
                    id="customer-email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="Email address"
                    type="email"
                  />
                  {formErrors.email ? <p className="text-xs text-amber-700">{formErrors.email}</p> : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customer-address">Address (optional)</Label>
                  <Input
                    id="customer-address"
                    value={form.address}
                    onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                    placeholder="Area or full address"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={createCustomer.isPending || updateCustomer.isPending || deleteCustomer.isPending}
                >
                  {formMode === "edit" ? "Save customer" : "Add customer"}
                </Button>
              </form>
            </section>

            <section className="app-panel rounded-[1.9rem] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">Quick access</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">Recent customers</h2>
                </div>
                <DataExportDialog
                  resource="customers"
                  title="Customers"
                  selectedIds={selectedCustomerIds}
                  disabled={isLoading || isError}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {recentCustomers.length === 0 ? (
                  <div className="app-empty-state w-full text-sm">
                    Add a customer to start building your digital khata.
                  </div>
                ) : (
                  recentCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectCustomer(customer.id)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm transition",
                        selectedCustomerId === customer.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:border-primary/40",
                      )}
                    >
                      {customer.name}
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="app-panel rounded-[1.9rem] p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">Customers</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">Search and select</h2>
                </div>
                <span className="app-chip">{customers.length} total</span>
              </div>

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, phone, or address"
                  className="pl-9"
                />
              </div>

              <div className="mt-4 grid gap-3">
                {isLoading ? <div className="app-loading-skeleton h-64 w-full" /> : null}
                {isError ? <p className="text-sm text-amber-700">Unable to load customers.</p> : null}
                {!isLoading && !isError && filteredCustomers.length === 0 ? (
                  <div className="app-empty-state text-sm">No customers match the current search.</div>
                ) : null}
                {!isLoading && !isError
                  ? filteredCustomers.map((customer) => {
                      const due = customer.outstandingBalance ?? 0;

                      return (
                        <div
                          key={customer.id}
                          className={cn(
                            "rounded-[1.4rem] border px-4 py-4 transition",
                            selectedCustomerId === customer.id
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:border-primary/30",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedCustomerIds.includes(customer.id)}
                              onChange={() => toggleCustomerSelection(customer.id)}
                              aria-label={`Select ${customer.name}`}
                            />

                            <button
                              type="button"
                              onClick={() => selectCustomer(customer.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="truncate text-base font-semibold text-foreground">{customer.name}</p>
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                                    due > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
                                  )}
                                >
                                  {due > 0 ? "Due" : "Settled"}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="app-chip">{customer.phone || "No phone"}</span>
                                <span className="app-chip">{formatCurrency(due, "INR")}</span>
                              </div>
                            </button>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => startEditing(customer)}>
                              <SquarePen className="size-4" />
                              Edit
                            </Button>
                            <Button type="button" variant="destructive" size="sm" onClick={() => void handleDeleteCustomer(customer.id)}>
                              <Trash2 className="size-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  : null}
              </div>
            </section>
          </div>

          <div className="grid gap-6">
            {selectedCustomer && ledger ? (
              <>
                <section className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Customer khata</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{selectedCustomer.name}</h2>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                          <Phone className="size-3.5" />
                          {selectedCustomer.phone || "No phone"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                          <MapPin className="size-3.5" />
                          {selectedCustomer.address || "No address"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                          <Clock3 className="size-3.5" />
                          Last payment {formatActivityDate(ledger.summary.lastPaymentDate, formatDate)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button asChild variant="outline">
                        <Link href="/invoices">
                          <ArrowUpRight className="size-4" />
                          Add bill
                        </Link>
                      </Button>
                      <Button type="button" variant="outline" onClick={handleShareStatement}>
                        <Share2 className="size-4" />
                        Share statement
                      </Button>
                      <Button type="button" variant="outline" onClick={handlePrintStatement}>
                        <Printer className="size-4" />
                        Print / Save PDF
                      </Button>
                      <Button type="button" onClick={openPaymentModal}>
                        <CreditCard className="size-4" />
                        Add payment
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3 text-amber-700">
                        <span className="text-sm">Total due</span>
                        <Wallet className="size-4" />
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-amber-950">
                        {formatCurrency(ledger.summary.outstandingBalance, "INR")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3 text-slate-600">
                        <span className="text-sm">Total billed</span>
                        <FileText className="size-4" />
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">
                        {formatCurrency(ledger.summary.totalBilled, "INR")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3 text-emerald-700">
                        <span className="text-sm">Total paid</span>
                        <CircleDollarSign className="size-4" />
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-emerald-950">
                        {formatCurrency(ledger.summary.totalPaid, "INR")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3 text-slate-600">
                        <span className="text-sm">Open invoices</span>
                        <Users className="size-4" />
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">
                        {ledger.summary.openInvoiceCount}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_320px]">
                  <section className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Ledger history</p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">Smart ledger statement</h3>
                        <p className="mt-2 text-sm text-slate-500">
                          Every invoice and payment updates the running balance automatically.
                        </p>
                      </div>
                      <div
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          ledger.summary.outstandingBalance > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
                        )}
                      >
                        {ledger.summary.outstandingBalance > 0 ? "Customer owes money" : "Account settled"}
                      </div>
                    </div>

                    {ledger.entries.length === 0 ? (
                      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        No ledger entries yet. Create a bill for this customer to start their khata history.
                      </div>
                    ) : (
                      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Date</th>
                              <th className="px-4 py-3 text-left font-medium">Description</th>
                              <th className="px-4 py-3 text-left font-medium">Debit</th>
                              <th className="px-4 py-3 text-left font-medium">Credit</th>
                              <th className="px-4 py-3 text-left font-medium">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledger.entries.map((entry) => (
                              <tr key={entry.id} className="border-t border-slate-200">
                                <td className="px-4 py-3 align-top text-slate-600">{formatActivityDate(entry.date, formatDate)}</td>
                                <td className="px-4 py-3 align-top">
                                  <p className="font-medium text-slate-950">{entry.description}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {entry.note || (entry.type === "invoice" ? "Debit entry" : "Credit entry")}
                                  </p>
                                </td>
                                <td className="px-4 py-3 align-top font-medium text-rose-700">
                                  {entry.debit > 0 ? formatCurrency(entry.debit, "INR") : "-"}
                                </td>
                                <td className="px-4 py-3 align-top font-medium text-emerald-700">
                                  {entry.credit > 0 ? formatCurrency(entry.credit, "INR") : "-"}
                                </td>
                                <td className="px-4 py-3 align-top font-semibold text-slate-950">
                                  {formatCurrency(entry.balance, "INR")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
                    <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Open invoices</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">Pending collection</h3>

                      {ledger.summary.openInvoices.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
                          This customer is fully settled.
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          {ledger.summary.openInvoices.map((invoice) => (
                            <div key={invoice.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-950">{invoice.invoiceNumber}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Issued {formatActivityDate(invoice.issueDate, formatDate)}
                                  </p>
                                </div>
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                  {invoice.status.replaceAll("_", " ")}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                                <span className="app-chip">Total {formatCurrency(invoice.total, "INR")}</span>
                                <span className="app-chip">Balance {formatCurrency(invoice.remaining, "INR")}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Collection note</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">Notebook feel, automatic math</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        This ledger behaves like a digital khata: invoices add debit, payments add credit, and the running balance updates after every entry.
                      </p>
                    </div>
                  </section>
                </section>
              </>
            ) : (
              <section className="rounded-[1.9rem] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                {ledgerLoading ? (
                  <p className="text-sm text-slate-500">Loading customer ledger...</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Customer ledger</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">Select a customer to view their khata</h2>
                    <p className="mt-3 text-sm text-slate-500">
                      You will see every bill, payment, and running balance in one place.
                    </p>
                  </>
                )}
              </section>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={paymentModalOpen}
        onOpenChange={(open) => {
          setPaymentModalOpen(open);
          if (!open) {
            setPaymentError(null);
          }
        }}
        title="Add payment"
        description="Record a payment against one of this customer's open invoices."
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ledger-payment-invoice">Invoice</Label>
            <select
              id="ledger-payment-invoice"
              value={paymentInvoiceId}
              onChange={(event) => {
                setPaymentInvoiceId(event.target.value);
                const nextInvoice = ledger?.summary.openInvoices.find(
                  (invoice) => invoice.id === Number(event.target.value),
                );
                if (nextInvoice) {
                  setPaymentAmount(String(nextInvoice.remaining));
                }
              }}
              className="app-field h-10 w-full px-3 py-2"
            >
              <option value="">Select invoice</option>
              {(ledger?.summary.openInvoices ?? []).map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} - {formatCurrency(invoice.remaining, "INR")}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ledger-payment-amount">Amount paid</Label>
            <Input
              id="ledger-payment-amount"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              placeholder="Enter amount"
              inputMode="decimal"
            />
          </div>

          {paymentError ? <p className="text-sm text-amber-700">{paymentError}</p> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleRecordPayment()}>
              Record payment
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default CustomersClient;
