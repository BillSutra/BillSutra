"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
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
  Sparkles,
  SquarePen,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import BeginnerGuideCard from "@/components/beginner/BeginnerGuideCard";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DataExportDialog from "@/components/export/DataExportDialog";
import FriendlyEmptyState from "@/components/ui/FriendlyEmptyState";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateInvoicePdf } from "@/lib/pdf/generateInvoicePdf";
import { cn } from "@/lib/utils";
import type {
  Customer,
  CustomerLedger,
  CustomerPaymentTerms,
} from "@/lib/apiClient";
import {
  INDIAN_STATES,
  formatBusinessAddress,
  formatCustomerAddressFromRecord,
  lookupIndianPincode,
  normalizeIndianPincode,
  normalizeIndianState,
  parseBusinessAddressText,
  toBusinessAddressInput,
} from "@/lib/indianAddress";
import { getStateFromGstin, isValidGstin, normalizeGstin } from "@/lib/gstin";
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

type CustomerType = "individual" | "business";

type CustomerFormState = {
  type: CustomerType;
  name: string;
  phone: string;
  email: string;
  businessName: string;
  gstin: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  creditLimit: string;
  paymentTerms: CustomerPaymentTerms;
  openingBalance: string;
};

type CustomerFormErrors = Partial<Record<keyof CustomerFormState, string>>;

const PAYMENT_TERMS_OPTIONS: Array<{
  value: CustomerPaymentTerms;
  labelKey: string;
}> = [
  {
    value: "DUE_ON_RECEIPT",
    labelKey: "customersPage.paymentTerms.dueOnReceipt",
  },
  {
    value: "NET_7",
    labelKey: "customersPage.paymentTerms.net7",
  },
  {
    value: "NET_15",
    labelKey: "customersPage.paymentTerms.net15",
  },
  {
    value: "NET_30",
    labelKey: "customersPage.paymentTerms.net30",
  },
];

const emptyForm: CustomerFormState = {
  type: "individual",
  name: "",
  phone: "",
  email: "",
  businessName: "",
  gstin: "",
  addressLine1: "",
  city: "",
  state: "",
  pincode: "",
  notes: "",
  creditLimit: "",
  paymentTerms: "DUE_ON_RECEIPT",
  openingBalance: "",
};

const EMAIL_TYPO_MAP: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "hotnail.com": "hotmail.com",
};

const suggestEmailTypo = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return "";
  }

  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain || !EMAIL_TYPO_MAP[domain]) {
    return "";
  }

  return `${localPart}@${EMAIL_TYPO_MAP[domain]}`;
};

const validateCustomerForm = (
  form: CustomerFormState,
  t: ReturnType<typeof useI18n>["t"],
) => {
  const errors: CustomerFormErrors = {};
  const trimmedName = form.name.trim();
  const normalizedPhone = form.phone.replace(/\D/g, "");
  const trimmedEmail = form.email.trim();
  const normalizedGstin = normalizeGstin(form.gstin);
  const normalizedAddress = toBusinessAddressInput({
    addressLine1: form.addressLine1,
    city: form.city,
    state: form.state,
    pincode: form.pincode,
  });

  const hasAddressInput = Boolean(
    normalizedAddress.addressLine1 ||
    normalizedAddress.city ||
    normalizedAddress.state ||
    normalizedAddress.pincode,
  );

  if (!trimmedName) {
    errors.name = t("customersPage.validation.enterName");
  } else if (trimmedName.length < 2) {
    errors.name = t("customersPage.validation.nameMin");
  } else if (!/^[\p{L}\p{M}\s.'-]+$/u.test(trimmedName)) {
    errors.name = t("customersPage.validation.nameChars");
  }

  if (!normalizedPhone) {
    errors.phone = t("customersPage.validation.enterPhone");
  } else if (!/^\d{10}$/.test(normalizedPhone)) {
    errors.phone = t("customersPage.validation.phoneDigits");
  }

  if (trimmedEmail && !/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(trimmedEmail)) {
    errors.email = t("customersPage.validation.emailOptional");
  }

  if (form.type === "business") {
    if (!form.businessName.trim()) {
      errors.businessName = t("customersPage.validation.businessNameRequired");
    } else if (form.businessName.trim().length < 2) {
      errors.businessName = t("customersPage.validation.businessNameMin");
    }

    if (normalizedGstin && !isValidGstin(normalizedGstin)) {
      errors.gstin = t("customersPage.validation.gstinInvalid");
    }
  }

  if (hasAddressInput) {
    if (!normalizedAddress.addressLine1) {
      errors.addressLine1 = t("customersPage.validation.addressLine1Required");
    }

    if (!normalizedAddress.city) {
      errors.city = t("customersPage.validation.cityRequired");
    }

    if (!normalizedAddress.state) {
      errors.state = t("customersPage.validation.stateRequired");
    }

    if (!/^\d{6}$/.test(normalizedAddress.pincode)) {
      errors.pincode = t("customersPage.validation.pincodeDigits");
    }
  }

  if (
    form.type === "business" &&
    normalizedGstin &&
    isValidGstin(normalizedGstin) &&
    normalizedAddress.state
  ) {
    const gstinState = getStateFromGstin(normalizedGstin);
    const selectedState = normalizeIndianState(normalizedAddress.state);

    if (gstinState && selectedState && gstinState !== selectedState) {
      errors.gstin = t("customersPage.validation.gstinStateMismatch");
    }
  }

  if (form.creditLimit.trim()) {
    const value = Number(form.creditLimit.trim());
    if (!Number.isFinite(value) || value < 0) {
      errors.creditLimit = t("customersPage.validation.creditLimitInvalid");
    }
  }

  if (form.openingBalance.trim()) {
    const value = Number(form.openingBalance.trim());
    if (!Number.isFinite(value) || value < 0) {
      errors.openingBalance = t(
        "customersPage.validation.openingBalanceInvalid",
      );
    }
  }

  if (form.notes.trim().length > 500) {
    errors.notes = t("customersPage.validation.notesTooLong");
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
  return formatDate(parsed, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getCustomerDisplayName = (customer: Customer) =>
  customer.type === "business"
    ? customer.businessName ||
      customer.business_name ||
      customer.display_name ||
      customer.name
    : customer.display_name || customer.name;

const buildStatementHtml = ({
  customer,
  ledger,
  formatCurrency,
  formatDate,
  t,
}: {
  customer: Customer;
  ledger: CustomerLedger;
  formatCurrency: ReturnType<typeof useI18n>["formatCurrency"];
  formatDate: ReturnType<typeof useI18n>["formatDate"];
  t: ReturnType<typeof useI18n>["t"];
}) => {
  const customerDisplayName = getCustomerDisplayName(customer);
  const customerAddress =
    formatCustomerAddressFromRecord(customer) ||
    customer.address ||
    t("customersPage.ledger.addressFallback");

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
        <title>${escapeHtml(
          t("customersPage.statement.documentTitle", {
            name: customerDisplayName,
          }),
        )}</title>
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
        <p class="label">${escapeHtml(t("customersPage.statement.heading"))}</p>
        <h1 style="margin-top: 8px;">${escapeHtml(customerDisplayName)}</h1>
        <p class="meta">${escapeHtml(customer.phone ?? t("customersPage.ledger.phoneFallback"))} | ${escapeHtml(customerAddress)}</p>
        <p class="meta">${escapeHtml(
          t("customersPage.statement.generatedOn", {
            date: formatDate(new Date(), {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          }),
        )}</p>
        <div class="summary">
          <div class="card"><p class="label">${escapeHtml(t("customersPage.statement.totalDue"))}</p><p class="value">${escapeHtml(formatCurrency(ledger.summary.outstandingBalance, "INR"))}</p></div>
          <div class="card"><p class="label">${escapeHtml(t("customersPage.statement.totalBilled"))}</p><p class="value">${escapeHtml(formatCurrency(ledger.summary.totalBilled, "INR"))}</p></div>
          <div class="card"><p class="label">${escapeHtml(t("customersPage.statement.totalPaid"))}</p><p class="value">${escapeHtml(formatCurrency(ledger.summary.totalPaid, "INR"))}</p></div>
        </div>
        <table>
          <thead>
            <tr><th>${escapeHtml(t("customersPage.ledger.columns.date"))}</th><th>${escapeHtml(t("customersPage.ledger.columns.description"))}</th><th>${escapeHtml(t("customersPage.ledger.columns.note"))}</th><th>${escapeHtml(t("customersPage.ledger.columns.debit"))}</th><th>${escapeHtml(t("customersPage.ledger.columns.credit"))}</th><th>${escapeHtml(t("customersPage.ledger.columns.balance"))}</th></tr>
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
  const { formatCurrency, formatDate, language, t } = useI18n();
  const { data, isLoading, isError } = useCustomersQuery();
  const createCustomer = useCreateCustomerMutation();
  const updateCustomer = useUpdateCustomerMutation();
  const deleteCustomer = useDeleteCustomerMutation();
  const createPayment = useCreatePaymentMutation();

  const customers = useMemo(() => data ?? [], [data]);
  const [query, setQuery] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null,
  );
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<CustomerFormErrors>({});
  const [showAddressDetails, setShowAddressDetails] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [showValidationState, setShowValidationState] = useState(false);
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<keyof CustomerFormState, boolean>>
  >({});
  const [autofillPending, setAutofillPending] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<{
    tone: "success" | "neutral" | "error";
    message: string;
  } | null>(null);
  const [lastAutofilledPincode, setLastAutofilledPincode] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [statementShareAction, setStatementShareAction] = useState<
    "copy" | "email" | "system" | "whatsapp" | null
  >(null);
  const [isPrintingStatement, setIsPrintingStatement] = useState(false);
  const [isNavigatingToBill, startBillNavigation] = useTransition();

  const liveFormErrors = useMemo(
    () => validateCustomerForm(form, t),
    [form, t],
  );
  const emailSuggestion = useMemo(
    () => suggestEmailTypo(form.email),
    [form.email],
  );
  const hasAddressInput = useMemo(
    () =>
      Boolean(
        form.addressLine1.trim() ||
        form.city.trim() ||
        form.state.trim() ||
        normalizeIndianPincode(form.pincode).length,
      ),
    [form.addressLine1, form.city, form.pincode, form.state],
  );

  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const ordered = [...customers].sort((left, right) => {
      const leftTime = new Date(
        left.lastActivityDate ?? left.lastPaymentDate ?? "",
      ).getTime();
      const rightTime = new Date(
        right.lastActivityDate ?? right.lastPaymentDate ?? "",
      ).getTime();
      return rightTime - leftTime;
    });

    if (!normalized) return ordered;

    return ordered.filter((customer) =>
      [
        customer.name,
        customer.businessName,
        customer.business_name,
        customer.gstin,
        customer.phone,
        customer.email,
        customer.address,
        formatCustomerAddressFromRecord(customer),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [customers, query]);

  const recentCustomers = useMemo(
    () => filteredCustomers.slice(0, 5),
    [filteredCustomers],
  );

  useEffect(() => {
    if (!showAddressDetails) {
      return;
    }

    const normalizedPincode = normalizeIndianPincode(form.pincode);
    if (
      normalizedPincode.length !== 6 ||
      normalizedPincode === lastAutofilledPincode
    ) {
      return;
    }

    let isCancelled = false;
    setAutofillPending(true);

    lookupIndianPincode(normalizedPincode)
      .then((result) => {
        if (isCancelled) {
          return;
        }

        if (!result) {
          setAutofillStatus({
            tone: "neutral",
            message: t("customersPage.messages.addressAutofillUnavailable"),
          });
          return;
        }

        setForm((prev) => ({
          ...prev,
          city: prev.city.trim() || result.city,
          state: prev.state.trim() || result.state,
          pincode: normalizedPincode,
        }));
        setAutofillStatus({
          tone: "success",
          message: t("customersPage.messages.addressAutofillSuccess"),
        });
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setAutofillStatus({
          tone: "error",
          message: t("customersPage.messages.addressAutofillError"),
        });
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }

        setAutofillPending(false);
        setLastAutofilledPincode(normalizedPincode);
      });

    return () => {
      isCancelled = true;
    };
  }, [form.pincode, lastAutofilledPincode, showAddressDetails, t]);

  useEffect(() => {
    const paramId = Number(searchParams.get("customer"));
    if (
      Number.isFinite(paramId) &&
      customers.some((customer) => customer.id === paramId)
    ) {
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
    () =>
      customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const { data: ledger, isLoading: ledgerLoading } = useCustomerLedgerQuery(
    selectedCustomerId ?? undefined,
  );
  const hasOpenInvoices = (ledger?.summary.openInvoices.length ?? 0) > 0;

  const statementShareText = useMemo(() => {
    if (!selectedCustomer || !ledger) return "";

    const customerDisplayName = getCustomerDisplayName(selectedCustomer);

    return [
      t("customersPage.ledger.summaryTitle", { name: customerDisplayName }),
      t("customersPage.ledger.shareOutstanding", {
        amount: formatCurrency(ledger.summary.outstandingBalance, "INR"),
      }),
      t("customersPage.ledger.shareLastPayment", {
        date: formatActivityDate(ledger.summary.lastPaymentDate, formatDate),
      }),
    ].join("\n");
  }, [formatCurrency, formatDate, ledger, selectedCustomer, t]);

  const statementShareUrl = useMemo(() => {
    if (!selectedCustomer || typeof window === "undefined") return "";
    return `${window.location.origin}/customers?customer=${selectedCustomer.id}`;
  }, [selectedCustomer]);

  const statementSharePayload = useMemo(() => {
    if (!statementShareText) return "";
    return statementShareUrl
      ? `${statementShareText}\n${statementShareUrl}`
      : statementShareText;
  }, [statementShareText, statementShareUrl]);

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
        label: t("customersPage.summary.totalOutstanding"),
        value: formatCurrency(totalOutstanding, "INR"),
        tone: "border-amber-200 bg-amber-50 text-amber-950",
        icon: Wallet,
      },
      {
        label: t("customersPage.summary.customersWithDue"),
        value: String(customersWithDue),
        tone: "border-rose-200 bg-rose-50 text-rose-950",
        icon: AlertCircle,
      },
      {
        label: t("customersPage.summary.settledAccounts"),
        value: String(settledCustomers),
        tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
        icon: CheckCircle2,
      },
    ];
  }, [customers, formatCurrency, t]);

  const disableCustomerSubmit =
    createCustomer.isPending ||
    updateCustomer.isPending ||
    deleteCustomer.isPending ||
    Object.keys(liveFormErrors).length > 0;

  useEffect(() => {
    if (showValidationState || Object.keys(touchedFields).length > 0) {
      setFormErrors(liveFormErrors);
    }
  }, [liveFormErrors, showValidationState, touchedFields]);

  const touchField = (field: keyof CustomerFormState) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const fieldMessage = (
    field: keyof CustomerFormState,
    options?: { showSuccess?: boolean },
  ) => {
    const showSuccess = options?.showSuccess ?? true;
    const shouldShow = showValidationState || Boolean(touchedFields[field]);
    if (!shouldShow) {
      return null;
    }

    const error = formErrors[field] ?? liveFormErrors[field];
    if (error) {
      return { tone: "error" as const, text: `❌ ${error}` };
    }

    if (!showSuccess) {
      return null;
    }

    const value = form[field];
    const isFilled =
      typeof value === "string" ? value.trim().length > 0 : Boolean(value);

    if (!isFilled) {
      return null;
    }

    return {
      tone: "success" as const,
      text: `✅ ${t("customersPage.validation.looksGood")}`,
    };
  };

  const updateFormField = <K extends keyof CustomerFormState>(
    field: K,
    value: CustomerFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setFormErrors({});
    setFormMode("create");
    setShowAddressDetails(false);
    setShowAdvancedDetails(false);
    setShowValidationState(false);
    setTouchedFields({});
    setAutofillStatus(null);
    setAutofillPending(false);
    setLastAutofilledPincode("");
  };

  const startEditing = (customer: Customer) => {
    setFormMode("edit");
    selectCustomer(customer.id);
    const parsedAddress = parseBusinessAddressText(customer.address);
    const normalizedAddress = toBusinessAddressInput({
      addressLine1:
        customer.customerAddress?.addressLine1 ??
        customer.address_line1 ??
        parsedAddress.addressLine1,
      city:
        customer.customerAddress?.city ?? customer.city ?? parsedAddress.city,
      state:
        customer.customerAddress?.state ??
        customer.state ??
        parsedAddress.state,
      pincode:
        customer.customerAddress?.pincode ??
        customer.pincode ??
        parsedAddress.pincode,
    });

    const customerType =
      customer.type ?? customer.customer_type ?? "individual";

    setForm({
      name: customer.name ?? "",
      type: customerType,
      phone: customer.phone?.replace(/\D/g, "") ?? "",
      email: customer.email ?? "",
      businessName: customer.businessName ?? customer.business_name ?? "",
      gstin: customer.gstin ?? "",
      addressLine1: normalizedAddress.addressLine1,
      city: normalizedAddress.city,
      state: normalizedAddress.state,
      pincode: normalizedAddress.pincode,
      notes: customer.notes ?? "",
      creditLimit:
        customer.creditLimit != null
          ? String(customer.creditLimit)
          : customer.credit_limit != null
            ? String(customer.credit_limit)
            : "",
      paymentTerms:
        customer.paymentTerms ?? customer.payment_terms ?? "DUE_ON_RECEIPT",
      openingBalance:
        customer.openingBalance != null
          ? String(customer.openingBalance)
          : customer.opening_balance != null
            ? String(customer.opening_balance)
            : "",
    });
    setShowAddressDetails(
      Boolean(
        normalizedAddress.addressLine1 ||
        normalizedAddress.city ||
        normalizedAddress.state ||
        normalizedAddress.pincode,
      ),
    );
    setShowAdvancedDetails(
      Boolean(
        customer.notes ||
        customer.creditLimit != null ||
        customer.credit_limit != null ||
        customer.openingBalance != null ||
        customer.opening_balance != null ||
        customer.paymentTerms ||
        customer.payment_terms,
      ),
    );
    setShowValidationState(false);
    setTouchedFields({});
    setAutofillStatus(null);
    setAutofillPending(false);
    setLastAutofilledPincode("");
    setFormErrors({});
  };

  const handleSaveCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    setShowValidationState(true);

    const errors = validateCustomerForm(form, t);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const normalizedAddress = toBusinessAddressInput({
      addressLine1: form.addressLine1,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
    });

    const hasStructuredAddress = Boolean(
      normalizedAddress.addressLine1 ||
      normalizedAddress.city ||
      normalizedAddress.state ||
      normalizedAddress.pincode,
    );

    const payload = {
      type: form.type,
      name: form.name.trim(),
      phone: form.phone.replace(/\D/g, ""),
      email: form.email.trim() || undefined,
      businessName:
        form.type === "business"
          ? form.businessName.trim() || undefined
          : undefined,
      gstin:
        form.type === "business" && form.gstin.trim()
          ? normalizeGstin(form.gstin)
          : undefined,
      customerAddress: hasStructuredAddress ? normalizedAddress : undefined,
      address_line1: hasStructuredAddress
        ? normalizedAddress.addressLine1
        : undefined,
      city: hasStructuredAddress ? normalizedAddress.city : undefined,
      state: hasStructuredAddress ? normalizedAddress.state : undefined,
      pincode: hasStructuredAddress ? normalizedAddress.pincode : undefined,
      address: hasStructuredAddress
        ? formatBusinessAddress(normalizedAddress)
        : undefined,
      notes: form.notes.trim() || undefined,
      creditLimit: form.creditLimit.trim()
        ? Number(form.creditLimit.trim())
        : undefined,
      paymentTerms: form.paymentTerms,
      openingBalance: form.openingBalance.trim()
        ? Number(form.openingBalance.trim())
        : undefined,
    };

    try {
      if (formMode === "edit" && selectedCustomerId) {
        await updateCustomer.mutateAsync({
          id: selectedCustomerId,
          payload,
        });
        toast.success(t("customersPage.messages.updated"));
      } else {
        const created = await createCustomer.mutateAsync(payload);
        toast.success(t("customersPage.messages.added"));
        selectCustomer(created.id);
      }
      resetForm();
    } catch {
      toast.error(t("customersPage.messages.saveError"));
    }
  };

  const handleDeleteCustomer = async (customerId: number) => {
    try {
      await deleteCustomer.mutateAsync(customerId);
      toast.success(t("customersPage.messages.removed"));
      if (selectedCustomerId === customerId) {
        const nextCustomer = customers.find(
          (customer) => customer.id !== customerId,
        );
        if (nextCustomer) {
          selectCustomer(nextCustomer.id);
        } else {
          setSelectedCustomerId(null);
          router.replace("/customers", { scroll: false });
        }
      }
    } catch {
      toast.error(t("customersPage.messages.removeError"));
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
      toast.error(t("customersPage.messages.noPendingInvoices"));
      return;
    }

    const nextInvoice = ledger.summary.openInvoices[0];
    setPaymentInvoiceId(String(nextInvoice.id));
    setPaymentAmount(String(nextInvoice.remaining));
    setPaymentError(null);
    setPaymentModalOpen(true);
  };

  const handleAddBill = () => {
    if (!selectedCustomer) return;

    const params = new URLSearchParams();
    params.set("customer", String(selectedCustomer.id));
    params.set("quickAction", "new-bill");

    startBillNavigation(() => {
      router.push(`/invoices?${params.toString()}`, { scroll: false });
    });
  };

  const handleRecordPayment = async () => {
    if (!ledger) return;

    const invoiceId = Number(paymentInvoiceId);
    const amount = Number(paymentAmount);
    const targetInvoice = ledger.summary.openInvoices.find(
      (invoice) => invoice.id === invoiceId,
    );

    if (!targetInvoice) {
      setPaymentError(t("customersPage.messages.selectInvoice"));
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError(t("customersPage.messages.enterValidPaymentAmount"));
      return;
    }

    if (amount > targetInvoice.remaining) {
      setPaymentError(
        t("customersPage.messages.paymentCannotExceed", {
          amount: formatCurrency(targetInvoice.remaining, "INR"),
        }),
      );
      return;
    }

    try {
      await createPayment.mutateAsync({
        invoice_id: invoiceId,
        amount,
        paid_at: new Date().toISOString(),
      });
      toast.success(t("customersPage.messages.paymentRecorded"));
      setPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentInvoiceId("");
      setPaymentError(null);
    } catch {
      setPaymentError(t("customersPage.messages.paymentRecordError"));
    }
  };

  const handlePrintStatement = async () => {
    if (!selectedCustomer || !ledger || typeof window === "undefined") return;

    setIsPrintingStatement(true);

    try {
      const statementHtml = buildStatementHtml({
        customer: selectedCustomer,
        ledger,
        formatCurrency,
        formatDate,
        t,
      });
      const parsedDocument = new DOMParser().parseFromString(
        statementHtml,
        "text/html",
      );
      const styleContent =
        parsedDocument.querySelector("style")?.textContent ?? "";

      const exportRoot = document.createElement("div");
      exportRoot.style.position = "fixed";
      exportRoot.style.left = "-99999px";
      exportRoot.style.top = "0";
      exportRoot.style.width = "794px";
      exportRoot.style.background = "#ffffff";
      exportRoot.style.padding = "0";
      exportRoot.style.zIndex = "-1";
      exportRoot.setAttribute("aria-hidden", "true");
      exportRoot.innerHTML = `
        <style>${styleContent}</style>
        <div class="customer-statement-export">
          ${parsedDocument.body.innerHTML}
        </div>
      `;

      document.body.appendChild(exportRoot);

      try {
        const statementCustomerName = getCustomerDisplayName(selectedCustomer);

        await generateInvoicePdf({
          element: exportRoot,
          fileName: `${
            statementCustomerName
              .replace(/[^a-z0-9]+/gi, "-")
              .replace(/^-+|-+$/g, "")
              .toLowerCase() || "customer"
          }-statement.pdf`,
          imageType: "png",
          quality: 1,
        });
      } finally {
        exportRoot.remove();
      }
    } finally {
      setIsPrintingStatement(false);
    }
  };

  const scrollToCustomerForm = () => {
    document.getElementById("customer-create-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const customerEmptyCopy =
    language === "hi"
      ? {
          title: "अभी कोई ग्राहक नहीं है",
          description:
            "अपना पहला ग्राहक जोड़ें ताकि बिल बनाते समय ग्राहक चुनना आसान हो।",
          hint: "शुरुआत के लिए ग्राहक का नाम और फोन नंबर काफी है। बाकी जानकारी बाद में भर सकते हैं।",
          primary: "ग्राहक जोड़ें",
          secondary: "बिल बनाएं",
        }
      : {
          title: "No customers yet",
          description:
            "Add your first customer so selecting someone while making a bill feels easy.",
          hint: "Start with customer name and phone number. You can fill the rest later.",
          primary: "Add Customer",
          secondary: "Create Bill",
        };
  const showBeginnerGuide =
    !isLoading && !isError && customers.length === 0 && !query.trim();
  const beginnerGuideCopy =
    language === "hi"
      ? {
          kicker: "स्टेप 3",
          title: "अब पहला ग्राहक जोड़ें",
          description:
            "ग्राहक का नाम और फोन जोड़ते ही बिल बनाते समय सही व्यक्ति चुनना आसान हो जाएगा।",
          progressLabel: "ग्राहक जोड़ना बिल बनाने से ठीक पहले वाला स्टेप है",
          steps: [
            {
              title: "दुकान और प्रोडक्ट तैयार करें",
              description:
                "अगर अभी तक नहीं किया है तो पहले दुकान और प्रोडक्ट सेट करें।",
              href: "/products",
              actionLabel: "प्रोडक्ट पेज खोलें",
            },
            {
              title: "पहला ग्राहक जोड़ें",
              description:
                "नाम और फोन भरना काफी है। बाकी जानकारी बाद में जोड़ सकते हैं।",
              active: true,
            },
            {
              title: "फिर बिल बनाएं",
              description:
                "ग्राहक सेव होते ही सीधे बिल स्क्रीन पर जा सकते हैं।",
              href: "/simple-bill",
              actionLabel: "बिल बनाएं",
            },
            {
              title: "जरूरत हो तो भुगतान ट्रैक करें",
              description:
                "यह स्क्रीन बाद में ग्राहक का बकाया और हिसाब भी दिखाएगी।",
            },
          ],
          primary: "फॉर्म तक जाएं",
          secondary: "सीधे बिल पेज खोलें",
        }
      : {
          kicker: "Step 3",
          title: "Add your first customer now",
          description:
            "Once the customer name and phone are saved, choosing the right person while creating a bill becomes easy.",
          progressLabel:
            "This is the step right before creating the first bill",
          steps: [
            {
              title: "Keep your shop and products ready",
              description: "If needed, finish the product step first.",
              href: "/products",
              actionLabel: "Open products",
            },
            {
              title: "Add your first customer",
              description: "Customer name and phone are enough for now.",
              active: true,
            },
            {
              title: "Create the bill next",
              description:
                "As soon as the customer is saved, you can jump straight to billing.",
              href: "/simple-bill",
              actionLabel: "Create bill",
            },
            {
              title: "Track payments later",
              description:
                "This page will also show dues and payment history after you start billing.",
            },
          ],
          primary: "Jump to form",
          secondary: "Open bill page",
        };

  const handleOpenShareStatement = () => {
    if (!selectedCustomer || !ledger) return;
    setShareModalOpen(true);
  };

  const handleShareStatement = async (
    channel: "copy" | "email" | "system" | "whatsapp",
  ) => {
    if (!selectedCustomer || !ledger || !statementSharePayload) return;

    setStatementShareAction(channel);

    try {
      if (channel === "system") {
        if (
          typeof navigator === "undefined" ||
          !("share" in navigator) ||
          !statementShareUrl
        ) {
          throw new Error("System share unavailable");
        }

        await navigator.share({
          title: `${getCustomerDisplayName(selectedCustomer)} ledger`,
          text: statementShareText,
          url: statementShareUrl,
        });
        setShareModalOpen(false);
        return;
      }

      if (channel === "copy") {
        if (
          typeof navigator === "undefined" ||
          !navigator.clipboard?.writeText
        ) {
          throw new Error("Clipboard unavailable");
        }

        await navigator.clipboard.writeText(statementSharePayload);
        toast.success(t("customersPage.messages.statementCopied"));
        setShareModalOpen(false);
        return;
      }

      if (typeof window === "undefined") {
        throw new Error("Window unavailable");
      }

      if (channel === "whatsapp") {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(statementSharePayload)}`;
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        setShareModalOpen(false);
        return;
      }

      const emailSubject = encodeURIComponent(
        `${getCustomerDisplayName(selectedCustomer)} ledger statement`,
      );
      const emailBody = encodeURIComponent(statementSharePayload);
      const recipient = selectedCustomer.email?.trim() ?? "";
      window.location.href = `mailto:${recipient}?subject=${emailSubject}&body=${emailBody}`;
      setShareModalOpen(false);
    } catch {
      toast.error(t("customersPage.messages.statementShareError"));
    } finally {
      setStatementShareAction(null);
    }
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("customersPage.pageTitle")}
      subtitle={t("customersPage.pageSubtitle")}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {showBeginnerGuide ? (
          <BeginnerGuideCard
            kicker={beginnerGuideCopy.kicker}
            title={beginnerGuideCopy.title}
            description={beginnerGuideCopy.description}
            icon={Sparkles}
            progressLabel={beginnerGuideCopy.progressLabel}
            steps={beginnerGuideCopy.steps}
            primaryAction={{
              label: beginnerGuideCopy.primary,
              onClick: scrollToCustomerForm,
            }}
            secondaryAction={{
              label: beginnerGuideCopy.secondary,
              href: "/simple-bill",
              variant: "outline",
            }}
          />
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className={cn("rounded-[1.6rem] border px-5 py-5", card.tone)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{card.label}</p>
                  <Icon className="size-4" />
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight">
                  {card.value}
                </p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="grid gap-6">
            <section className="app-panel rounded-[1.9rem] p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">
                    {t("customersPage.managementKicker")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">
                    {formMode === "edit"
                      ? t("customersPage.editTitle")
                      : t("customers.addTitle")}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("customersPage.formHint")}
                  </p>
                </div>
                {formMode === "edit" ? (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t("common.cancel")}
                  </Button>
                ) : null}
              </div>

              <form
                id="customer-create-form"
                className="mt-5 grid gap-4"
                onSubmit={handleSaveCustomer}
                noValidate
              >
                <div className="grid gap-2">
                  <Label htmlFor="customer-type">
                    {t("customersPage.fields.customerType")}
                  </Label>
                  <select
                    id="customer-type"
                    className="app-field h-10 w-full px-3 py-2"
                    value={form.type}
                    onChange={(event) => {
                      const nextType = event.target.value as CustomerType;
                      updateFormField("type", nextType);
                      touchField("type");

                      if (nextType === "individual") {
                        updateFormField("businessName", "");
                        updateFormField("gstin", "");
                      }
                    }}
                  >
                    <option value="individual">
                      {t("customersPage.customerType.individual")}
                    </option>
                    <option value="business">
                      {t("customersPage.customerType.business")}
                    </option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {t("customersPage.form.customerTypeHint")}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customer-name">
                    {t("customers.fields.name")}
                  </Label>
                  <Input
                    id="customer-name"
                    value={form.name}
                    onChange={(event) =>
                      updateFormField("name", event.target.value)
                    }
                    onBlur={() => touchField("name")}
                    placeholder={t("customers.placeholders.name")}
                  />
                  {fieldMessage("name") ? (
                    <p
                      className={cn(
                        "text-xs",
                        fieldMessage("name")?.tone === "error"
                          ? "text-amber-700"
                          : "text-emerald-700",
                      )}
                    >
                      {fieldMessage("name")?.text}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customer-phone">
                    {t("customers.fields.phone")}
                  </Label>
                  <Input
                    id="customer-phone"
                    value={form.phone}
                    onChange={(event) =>
                      updateFormField(
                        "phone",
                        event.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    onBlur={() => touchField("phone")}
                    placeholder={t("customersPage.phonePlaceholder")}
                    inputMode="numeric"
                  />
                  {fieldMessage("phone") ? (
                    <p
                      className={cn(
                        "text-xs",
                        fieldMessage("phone")?.tone === "error"
                          ? "text-amber-700"
                          : "text-emerald-700",
                      )}
                    >
                      {fieldMessage("phone")?.text}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customer-email">
                    {t("customersPage.emailOptional")}
                  </Label>
                  <Input
                    id="customer-email"
                    value={form.email}
                    onChange={(event) =>
                      updateFormField("email", event.target.value)
                    }
                    onBlur={() => touchField("email")}
                    placeholder={t("customers.fields.email")}
                    type="email"
                  />
                  {emailSuggestion && !liveFormErrors.email ? (
                    <button
                      type="button"
                      className="w-fit text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        updateFormField("email", emailSuggestion);
                        touchField("email");
                      }}
                    >
                      {t("customersPage.validation.emailSuggestion", {
                        suggestion: emailSuggestion,
                      })}
                    </button>
                  ) : null}
                  {fieldMessage("email", {
                    showSuccess: Boolean(form.email.trim()),
                  }) ? (
                    <p
                      className={cn(
                        "text-xs",
                        fieldMessage("email", {
                          showSuccess: Boolean(form.email.trim()),
                        })?.tone === "error"
                          ? "text-amber-700"
                          : "text-emerald-700",
                      )}
                    >
                      {
                        fieldMessage("email", {
                          showSuccess: Boolean(form.email.trim()),
                        })?.text
                      }
                    </p>
                  ) : null}
                </div>

                {form.type === "business" ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="customer-business-name">
                        {t("customersPage.fields.businessName")}
                      </Label>
                      <Input
                        id="customer-business-name"
                        value={form.businessName}
                        onChange={(event) =>
                          updateFormField("businessName", event.target.value)
                        }
                        onBlur={() => touchField("businessName")}
                        placeholder={t(
                          "customersPage.placeholders.businessName",
                        )}
                      />
                      {fieldMessage("businessName") ? (
                        <p
                          className={cn(
                            "text-xs",
                            fieldMessage("businessName")?.tone === "error"
                              ? "text-amber-700"
                              : "text-emerald-700",
                          )}
                        >
                          {fieldMessage("businessName")?.text}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="customer-gstin">
                        {t("customersPage.fields.gstin")}
                      </Label>
                      <Input
                        id="customer-gstin"
                        value={form.gstin}
                        onChange={(event) =>
                          updateFormField(
                            "gstin",
                            normalizeGstin(event.target.value),
                          )
                        }
                        onBlur={() => touchField("gstin")}
                        placeholder={t("customersPage.placeholders.gstin")}
                        maxLength={15}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("customersPage.form.gstinHint")}
                      </p>
                      {fieldMessage("gstin", {
                        showSuccess: Boolean(form.gstin.trim()),
                      }) ? (
                        <p
                          className={cn(
                            "text-xs",
                            fieldMessage("gstin", {
                              showSuccess: Boolean(form.gstin.trim()),
                            })?.tone === "error"
                              ? "text-amber-700"
                              : "text-emerald-700",
                          )}
                        >
                          {
                            fieldMessage("gstin", {
                              showSuccess: Boolean(form.gstin.trim()),
                            })?.text
                          }
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}

                <div className="rounded-2xl border border-border/60 p-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left"
                    onClick={() => setShowAddressDetails((prev) => !prev)}
                  >
                    <span className="text-sm font-medium">
                      {t("customersPage.form.addAddressDetails")}
                    </span>
                    {showAddressDetails ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  {showAddressDetails || hasAddressInput ? (
                    <div className="mt-3 grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="customer-address-line1">
                          {t("customersPage.fields.addressLine1")}
                        </Label>
                        <Input
                          id="customer-address-line1"
                          value={form.addressLine1}
                          onChange={(event) =>
                            updateFormField("addressLine1", event.target.value)
                          }
                          onBlur={() => touchField("addressLine1")}
                          onPaste={(event) => {
                            const pastedText =
                              event.clipboardData.getData("text");
                            const parsed = parseBusinessAddressText(pastedText);
                            if (
                              !parsed.addressLine1 &&
                              !parsed.city &&
                              !parsed.state &&
                              !parsed.pincode
                            ) {
                              return;
                            }

                            event.preventDefault();
                            const normalized = toBusinessAddressInput({
                              addressLine1: parsed.addressLine1 ?? pastedText,
                              city: parsed.city,
                              state: parsed.state,
                              pincode: parsed.pincode,
                            });

                            setForm((prev) => ({
                              ...prev,
                              addressLine1:
                                normalized.addressLine1 || prev.addressLine1,
                              city: normalized.city || prev.city,
                              state: normalized.state || prev.state,
                              pincode: normalized.pincode || prev.pincode,
                            }));
                            setShowAddressDetails(true);
                            setAutofillStatus({
                              tone: "neutral",
                              message: t(
                                "customersPage.messages.addressParsed",
                              ),
                            });
                          }}
                          placeholder={t(
                            "customersPage.placeholders.addressLine1",
                          )}
                        />
                        {fieldMessage("addressLine1", {
                          showSuccess: Boolean(form.addressLine1.trim()),
                        }) ? (
                          <p
                            className={cn(
                              "text-xs",
                              fieldMessage("addressLine1", {
                                showSuccess: Boolean(form.addressLine1.trim()),
                              })?.tone === "error"
                                ? "text-amber-700"
                                : "text-emerald-700",
                            )}
                          >
                            {
                              fieldMessage("addressLine1", {
                                showSuccess: Boolean(form.addressLine1.trim()),
                              })?.text
                            }
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="customer-city">
                            {t("customersPage.fields.city")}
                          </Label>
                          <Input
                            id="customer-city"
                            value={form.city}
                            onChange={(event) =>
                              updateFormField("city", event.target.value)
                            }
                            onBlur={() => touchField("city")}
                            placeholder={t("customersPage.placeholders.city")}
                          />
                          {fieldMessage("city", {
                            showSuccess: Boolean(form.city.trim()),
                          }) ? (
                            <p
                              className={cn(
                                "text-xs",
                                fieldMessage("city", {
                                  showSuccess: Boolean(form.city.trim()),
                                })?.tone === "error"
                                  ? "text-amber-700"
                                  : "text-emerald-700",
                              )}
                            >
                              {
                                fieldMessage("city", {
                                  showSuccess: Boolean(form.city.trim()),
                                })?.text
                              }
                            </p>
                          ) : null}
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="customer-state">
                            {t("customersPage.fields.state")}
                          </Label>
                          <select
                            id="customer-state"
                            className="app-field h-10 w-full px-3 py-2"
                            value={form.state}
                            onChange={(event) =>
                              updateFormField(
                                "state",
                                normalizeIndianState(event.target.value),
                              )
                            }
                            onBlur={() => touchField("state")}
                          >
                            <option value="">
                              {t("customersPage.placeholders.state")}
                            </option>
                            {INDIAN_STATES.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                          {fieldMessage("state", {
                            showSuccess: Boolean(form.state.trim()),
                          }) ? (
                            <p
                              className={cn(
                                "text-xs",
                                fieldMessage("state", {
                                  showSuccess: Boolean(form.state.trim()),
                                })?.tone === "error"
                                  ? "text-amber-700"
                                  : "text-emerald-700",
                              )}
                            >
                              {
                                fieldMessage("state", {
                                  showSuccess: Boolean(form.state.trim()),
                                })?.text
                              }
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="customer-pincode">
                          {t("customersPage.fields.pincode")}
                        </Label>
                        <Input
                          id="customer-pincode"
                          value={form.pincode}
                          onChange={(event) =>
                            updateFormField(
                              "pincode",
                              normalizeIndianPincode(event.target.value),
                            )
                          }
                          onBlur={() => touchField("pincode")}
                          placeholder={t("customersPage.placeholders.pincode")}
                          inputMode="numeric"
                        />
                        {fieldMessage("pincode", {
                          showSuccess:
                            normalizeIndianPincode(form.pincode).length > 0,
                        }) ? (
                          <p
                            className={cn(
                              "text-xs",
                              fieldMessage("pincode", {
                                showSuccess:
                                  normalizeIndianPincode(form.pincode).length >
                                  0,
                              })?.tone === "error"
                                ? "text-amber-700"
                                : "text-emerald-700",
                            )}
                          >
                            {
                              fieldMessage("pincode", {
                                showSuccess:
                                  normalizeIndianPincode(form.pincode).length >
                                  0,
                              })?.text
                            }
                          </p>
                        ) : null}
                      </div>

                      {autofillStatus ? (
                        <p
                          className={cn(
                            "text-xs",
                            autofillStatus.tone === "error"
                              ? "text-amber-700"
                              : autofillStatus.tone === "success"
                                ? "text-emerald-700"
                                : "text-muted-foreground",
                          )}
                        >
                          {autofillPending
                            ? t("customersPage.messages.addressAutofillLoading")
                            : autofillStatus.message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border/60 p-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left"
                    onClick={() => setShowAdvancedDetails((prev) => !prev)}
                  >
                    <span className="text-sm font-medium">
                      {t("customersPage.form.addMoreDetails")}
                    </span>
                    {showAdvancedDetails ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  {showAdvancedDetails ? (
                    <div className="mt-3 grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="customer-notes">
                          {t("customersPage.fields.notes")}
                        </Label>
                        <textarea
                          id="customer-notes"
                          className="app-field min-h-[86px] w-full resize-y px-3 py-2"
                          value={form.notes}
                          onChange={(event) =>
                            updateFormField("notes", event.target.value)
                          }
                          onBlur={() => touchField("notes")}
                          placeholder={t("customersPage.placeholders.notes")}
                          maxLength={500}
                        />
                        {fieldMessage("notes", { showSuccess: false }) ? (
                          <p className="text-xs text-amber-700">
                            {
                              fieldMessage("notes", { showSuccess: false })
                                ?.text
                            }
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="customer-credit-limit">
                            {t("customersPage.fields.creditLimit")}
                          </Label>
                          <Input
                            id="customer-credit-limit"
                            value={form.creditLimit}
                            onChange={(event) =>
                              updateFormField("creditLimit", event.target.value)
                            }
                            onBlur={() => touchField("creditLimit")}
                            placeholder={t(
                              "customersPage.placeholders.creditLimit",
                            )}
                            inputMode="decimal"
                          />
                          {fieldMessage("creditLimit", {
                            showSuccess: Boolean(form.creditLimit.trim()),
                          }) ? (
                            <p
                              className={cn(
                                "text-xs",
                                fieldMessage("creditLimit", {
                                  showSuccess: Boolean(form.creditLimit.trim()),
                                })?.tone === "error"
                                  ? "text-amber-700"
                                  : "text-emerald-700",
                              )}
                            >
                              {
                                fieldMessage("creditLimit", {
                                  showSuccess: Boolean(form.creditLimit.trim()),
                                })?.text
                              }
                            </p>
                          ) : null}
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="customer-opening-balance">
                            {t("customersPage.fields.openingBalance")}
                          </Label>
                          <Input
                            id="customer-opening-balance"
                            value={form.openingBalance}
                            onChange={(event) =>
                              updateFormField(
                                "openingBalance",
                                event.target.value,
                              )
                            }
                            onBlur={() => touchField("openingBalance")}
                            placeholder={t(
                              "customersPage.placeholders.openingBalance",
                            )}
                            inputMode="decimal"
                          />
                          {fieldMessage("openingBalance", {
                            showSuccess: Boolean(form.openingBalance.trim()),
                          }) ? (
                            <p
                              className={cn(
                                "text-xs",
                                fieldMessage("openingBalance", {
                                  showSuccess: Boolean(
                                    form.openingBalance.trim(),
                                  ),
                                })?.tone === "error"
                                  ? "text-amber-700"
                                  : "text-emerald-700",
                              )}
                            >
                              {
                                fieldMessage("openingBalance", {
                                  showSuccess: Boolean(
                                    form.openingBalance.trim(),
                                  ),
                                })?.text
                              }
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="customer-payment-terms">
                          {t("customersPage.fields.paymentTerms")}
                        </Label>
                        <select
                          id="customer-payment-terms"
                          className="app-field h-10 w-full px-3 py-2"
                          value={form.paymentTerms}
                          onChange={(event) =>
                            updateFormField(
                              "paymentTerms",
                              event.target.value as CustomerPaymentTerms,
                            )
                          }
                        >
                          {PAYMENT_TERMS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {t(option.labelKey)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground">
                  {t("customersPage.form.submitHint")}
                </p>

                <Button type="submit" disabled={disableCustomerSubmit}>
                  {formMode === "edit"
                    ? t("customersPage.actions.saveCustomer")
                    : t("customers.actions.add")}
                </Button>
              </form>
            </section>

            <section className="app-panel rounded-[1.9rem] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">
                    {t("customersPage.recentKicker")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">
                    {t("customersPage.recentTitle")}
                  </h2>
                </div>
                <DataExportDialog
                  resource="customers"
                  title={t("customers.title")}
                  selectedIds={selectedCustomerIds}
                  disabled={isLoading || isError}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {recentCustomers.length === 0 ? (
                  <div className="app-empty-state w-full text-sm">
                    {t("customers.addDescription")}
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
                      {getCustomerDisplayName(customer)}
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="app-panel rounded-[1.9rem] p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">
                    {t("customersPage.searchKicker")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">
                    {t("customersPage.searchTitle")}
                  </h2>
                </div>
                <span className="app-chip">
                  {t("customersPage.totalCount", { count: customers.length })}
                </span>
              </div>

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("customersPage.searchPlaceholder")}
                  className="pl-9"
                />
              </div>

              <div className="mt-4 grid gap-3">
                {isLoading ? (
                  <div className="app-loading-skeleton h-64 w-full" />
                ) : null}
                {isError ? (
                  <p className="text-sm text-amber-700">
                    {t("customers.loadError")}
                  </p>
                ) : null}
                {!isLoading && !isError && filteredCustomers.length === 0 ? (
                  customers.length === 0 && !query.trim() ? (
                    <FriendlyEmptyState
                      icon={Users}
                      title={customerEmptyCopy.title}
                      description={customerEmptyCopy.description}
                      hint={customerEmptyCopy.hint}
                      primaryAction={{
                        label: customerEmptyCopy.primary,
                        onClick: scrollToCustomerForm,
                      }}
                      secondaryAction={{
                        label: customerEmptyCopy.secondary,
                        href: "/invoices",
                        variant: "outline",
                      }}
                    />
                  ) : (
                    <div className="app-empty-state text-sm">
                      {t("customersPage.searchEmpty")}
                    </div>
                  )
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
                              checked={selectedCustomerIds.includes(
                                customer.id,
                              )}
                              onChange={() =>
                                toggleCustomerSelection(customer.id)
                              }
                              aria-label={t(
                                "customersPage.ledger.selectCustomer",
                                {
                                  name: getCustomerDisplayName(customer),
                                },
                              )}
                            />

                            <button
                              type="button"
                              onClick={() => selectCustomer(customer.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="truncate text-base font-semibold text-foreground">
                                  {getCustomerDisplayName(customer)}
                                </p>
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                                    due > 0
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-emerald-100 text-emerald-700",
                                  )}
                                >
                                  {due > 0
                                    ? t("customersPage.status.due")
                                    : t("customersPage.status.settled")}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {customer.type === "business" ? (
                                  <span className="app-chip">
                                    {t("customersPage.customerType.business")}
                                  </span>
                                ) : null}
                                <span className="app-chip">
                                  {customer.phone ||
                                    t("customersPage.ledger.phoneFallback")}
                                </span>
                                {customer.gstin ? (
                                  <span className="app-chip">
                                    GSTIN: {customer.gstin}
                                  </span>
                                ) : null}
                                <span className="app-chip">
                                  {formatCurrency(due, "INR")}
                                </span>
                              </div>
                            </button>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => startEditing(customer)}
                            >
                              <SquarePen className="size-4" />
                              {t("customers.actions.edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                void handleDeleteCustomer(customer.id)
                              }
                            >
                              <Trash2 className="size-4" />
                              {t("customers.actions.delete")}
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
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {t("customersPage.ledger.title")}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                        {getCustomerDisplayName(selectedCustomer)}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        {selectedCustomer.type === "business" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                            {t("customersPage.customerType.business")}
                          </span>
                        ) : null}
                        {selectedCustomer.gstin ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                            GSTIN: {selectedCustomer.gstin}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                          <Phone className="size-3.5" />
                          {selectedCustomer.phone ||
                            t("customersPage.ledger.phoneFallback")}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                          <MapPin className="size-3.5" />
                          {formatCustomerAddressFromRecord(selectedCustomer) ||
                            selectedCustomer.address ||
                            t("customersPage.ledger.addressFallback")}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                          <Clock3 className="size-3.5" />
                          {t("customersPage.ledger.lastPayment", {
                            date: formatActivityDate(
                              ledger.summary.lastPaymentDate,
                              formatDate,
                            ),
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddBill}
                        disabled={isNavigatingToBill}
                      >
                        <ArrowUpRight className="size-4" />
                        {isNavigatingToBill
                          ? `${t("customersPage.actions.addBill")}...`
                          : t("customersPage.actions.addBill")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleOpenShareStatement}
                      >
                        <Share2 className="size-4" />
                        {t("customersPage.actions.shareStatement")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handlePrintStatement()}
                        disabled={isPrintingStatement}
                      >
                        <Printer className="size-4" />
                        {isPrintingStatement
                          ? `${t("customersPage.actions.printSavePdf")}...`
                          : t("customersPage.actions.printSavePdf")}
                      </Button>
                      <Button
                        type="button"
                        onClick={openPaymentModal}
                        disabled={!hasOpenInvoices || createPayment.isPending}
                        title={
                          !hasOpenInvoices
                            ? t("customersPage.messages.noPendingInvoices")
                            : undefined
                        }
                      >
                        <CreditCard className="size-4" />
                        {createPayment.isPending
                          ? `${t("customersPage.actions.addPayment")}...`
                          : t("customersPage.actions.addPayment")}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3 text-amber-700">
                        <span className="text-sm">
                          {t("customersPage.ledger.totalDue")}
                        </span>
                        <Wallet className="size-4" />
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-amber-950">
                        {formatCurrency(
                          ledger.summary.outstandingBalance,
                          "INR",
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3 text-slate-600">
                        <span className="text-sm">
                          {t("customersPage.ledger.totalBilled")}
                        </span>
                        <FileText className="size-4" />
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">
                        {formatCurrency(ledger.summary.totalBilled, "INR")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3 text-emerald-700">
                        <span className="text-sm">
                          {t("customersPage.ledger.totalPaid")}
                        </span>
                        <CircleDollarSign className="size-4" />
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-emerald-950">
                        {formatCurrency(ledger.summary.totalPaid, "INR")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3 text-slate-600">
                        <span className="text-sm">
                          {t("customersPage.ledger.openInvoices")}
                        </span>
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
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          {t("customersPage.ledger.historyKicker")}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">
                          {t("customersPage.ledger.historyTitle")}
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                          {t("customersPage.ledger.historyDescription")}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          ledger.summary.outstandingBalance > 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-emerald-100 text-emerald-700",
                        )}
                      >
                        {ledger.summary.outstandingBalance > 0
                          ? t("customersPage.ledger.customerOwes")
                          : t("customersPage.ledger.accountSettled")}
                      </div>
                    </div>

                    {ledger.entries.length === 0 ? (
                      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        {t("customersPage.ledger.noEntries")}
                      </div>
                    ) : (
                      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">
                                {t("customersPage.ledger.columns.date")}
                              </th>
                              <th className="px-4 py-3 text-left font-medium">
                                {t("customersPage.ledger.columns.description")}
                              </th>
                              <th className="px-4 py-3 text-left font-medium">
                                {t("customersPage.ledger.columns.debit")}
                              </th>
                              <th className="px-4 py-3 text-left font-medium">
                                {t("customersPage.ledger.columns.credit")}
                              </th>
                              <th className="px-4 py-3 text-left font-medium">
                                {t("customersPage.ledger.columns.balance")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledger.entries.map((entry) => (
                              <tr
                                key={entry.id}
                                className="border-t border-slate-200"
                              >
                                <td className="px-4 py-3 align-top text-slate-600">
                                  {formatActivityDate(entry.date, formatDate)}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <p className="font-medium text-slate-950">
                                    {entry.description}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {entry.note ||
                                      (entry.type === "invoice"
                                        ? t("customersPage.ledger.debitEntry")
                                        : t(
                                            "customersPage.ledger.creditEntry",
                                          ))}
                                  </p>
                                </td>
                                <td className="px-4 py-3 align-top font-medium text-rose-700">
                                  {entry.debit > 0
                                    ? formatCurrency(entry.debit, "INR")
                                    : "-"}
                                </td>
                                <td className="px-4 py-3 align-top font-medium text-emerald-700">
                                  {entry.credit > 0
                                    ? formatCurrency(entry.credit, "INR")
                                    : "-"}
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
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {t("customersPage.ledger.openInvoicesKicker")}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">
                        {t("customersPage.ledger.openInvoicesTitle")}
                      </h3>

                      {ledger.summary.openInvoices.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
                          {t("customersPage.ledger.fullySettled")}
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          {ledger.summary.openInvoices.map((invoice) => (
                            <div
                              key={invoice.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-950">
                                    {invoice.invoiceNumber}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {t("customersPage.ledger.issuedOn", {
                                      date: formatActivityDate(
                                        invoice.issueDate,
                                        formatDate,
                                      ),
                                    })}
                                  </p>
                                </div>
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                  {t(
                                    `exportDialog.statuses.${invoice.status}`,
                                  ) ===
                                  `exportDialog.statuses.${invoice.status}`
                                    ? invoice.status.replaceAll("_", " ")
                                    : t(
                                        `exportDialog.statuses.${invoice.status}`,
                                      )}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                                <span className="app-chip">
                                  {t("invoiceDetail.totalLabel")}:{" "}
                                  {formatCurrency(invoice.total, "INR")}
                                </span>
                                <span className="app-chip">
                                  {t("invoiceDetail.remainingLabel")}:{" "}
                                  {formatCurrency(invoice.remaining, "INR")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {t("customersPage.ledger.collectionNoteKicker")}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">
                        {t("customersPage.ledger.collectionNoteTitle")}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {t("customersPage.ledger.collectionNoteBody")}
                      </p>
                    </div>
                  </section>
                </section>
              </>
            ) : (
              <section className="rounded-[1.9rem] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                {ledgerLoading ? (
                  <p className="text-sm text-slate-500">
                    {t("customersPage.ledger.loading")}
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {t("customersPage.ledger.emptyKicker")}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                      {t("customersPage.ledger.emptyTitle")}
                    </h2>
                    <p className="mt-3 text-sm text-slate-500">
                      {t("customersPage.ledger.emptyDescription")}
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
        title={t("customersPage.actions.addPayment")}
        description={t("customersPage.messages.selectInvoice")}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ledger-payment-invoice">
              {t("customersPage.ledger.selectInvoice")}
            </Label>
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
              <option value="">
                {t("customersPage.ledger.selectInvoice")}
              </option>
              {(ledger?.summary.openInvoices ?? []).map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} -{" "}
                  {formatCurrency(invoice.remaining, "INR")}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ledger-payment-amount">
              {t("customersPage.ledger.amountPaid")}
            </Label>
            <Input
              id="ledger-payment-amount"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              placeholder={t("customersPage.ledger.amountPlaceholder")}
              inputMode="decimal"
            />
          </div>

          {paymentError ? (
            <p className="text-sm text-amber-700">{paymentError}</p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentModalOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void handleRecordPayment()}
              disabled={createPayment.isPending}
            >
              {createPayment.isPending
                ? `${t("customersPage.actions.recordPayment")}...`
                : t("customersPage.actions.recordPayment")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={shareModalOpen}
        onOpenChange={(open) => {
          setShareModalOpen(open);
          if (!open) {
            setStatementShareAction(null);
          }
        }}
        title={t("customersPage.actions.shareStatement")}
        description={t("customersPage.ledger.historyDescription")}
      >
        <div className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-950">
              {selectedCustomer
                ? getCustomerDisplayName(selectedCustomer)
                : "-"}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
              {statementShareText}
            </p>
            {statementShareUrl ? (
              <p className="mt-2 break-all text-xs text-slate-500">
                {statementShareUrl}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {typeof navigator !== "undefined" && "share" in navigator ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleShareStatement("system")}
                disabled={statementShareAction !== null}
              >
                {statementShareAction === "system"
                  ? "Opening..."
                  : "Open share sheet"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleShareStatement("whatsapp")}
              disabled={statementShareAction !== null}
            >
              {statementShareAction === "whatsapp"
                ? "Opening..."
                : "Share on WhatsApp"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleShareStatement("email")}
              disabled={statementShareAction !== null}
            >
              {statementShareAction === "email"
                ? "Opening..."
                : "Share by email"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleShareStatement("copy")}
              disabled={statementShareAction !== null}
            >
              {statementShareAction === "copy" ? "Copying..." : "Copy summary"}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default CustomersClient;
