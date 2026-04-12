"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Contact2, CreditCard, Search, Truck } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FriendlyEmptyState from "@/components/ui/FriendlyEmptyState";
import { ValidationField } from "@/components/ui/ValidationField";
import SupplierFormSection from "@/components/suppliers/SupplierFormSection";
import SupplierListItem from "@/components/suppliers/SupplierListItem";
import SupplierSmartHints from "@/components/suppliers/SupplierSmartHints";
import {
  validateGstin,
  validateIndianPincode,
  validateIndianState,
  translateValidationMessage,
  validateEmail,
  validateName,
  validatePan,
  validatePhone,
  validateRequired,
} from "@/lib/validation";
import {
  useCreateSupplierMutation,
  useDeleteSupplierMutation,
  useSuppliersQuery,
  useUpdateSupplierMutation,
} from "@/hooks/useInventoryQueries";
import type {
  Supplier,
  SupplierInput,
  SupplierPaymentTerms,
} from "@/lib/apiClient";
import {
  INDIAN_STATES,
  lookupIndianPincode,
  normalizeIndianPincode,
  normalizeIndianState,
} from "@/lib/indianAddress";
import { getStateFromGstin, normalizeGstin } from "@/lib/gstin";
import { useI18n } from "@/providers/LanguageProvider";

type SuppliersClientProps = {
  name: string;
  image?: string;
};

type SupplierFormState = {
  name: string;
  phone: string;
  email: string;
  businessName: string;
  gstin: string;
  pan: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  paymentTerms: SupplierPaymentTerms;
  openingBalance: string;
  notes: string;
};

type SupplierFormErrors = Partial<Record<keyof SupplierFormState, string>>;

const PAYMENT_TERM_OPTIONS: SupplierPaymentTerms[] = ["NET_7", "NET_15", "NET_30"];

const INITIAL_FORM: SupplierFormState = {
  name: "",
  phone: "",
  email: "",
  businessName: "",
  gstin: "",
  pan: "",
  addressLine1: "",
  city: "",
  state: "",
  pincode: "",
  paymentTerms: "NET_15",
  openingBalance: "",
  notes: "",
};

const resolveSupplierName = (supplier: Supplier) =>
  supplier.businessName || supplier.business_name || supplier.name;

const normalizePhoneInput = (value: string) => value.replace(/\D/g, "").slice(0, 10);

const normalizePanInput = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

const toSupplierForm = (supplier: Supplier): SupplierFormState => {
  const address = supplier.supplierAddress ?? {
    addressLine1: supplier.address_line1 ?? "",
    city: supplier.city ?? "",
    state: supplier.state ?? "",
    pincode: supplier.pincode ?? "",
  };

  const openingBalance = Number(
    supplier.openingBalance ?? supplier.opening_balance ?? 0,
  );

  return {
    name: supplier.name ?? "",
    phone: normalizePhoneInput(supplier.phone ?? ""),
    email: supplier.email ?? "",
    businessName: supplier.businessName ?? supplier.business_name ?? "",
    gstin: normalizeGstin(supplier.gstin ?? ""),
    pan: normalizePanInput(supplier.pan ?? ""),
    addressLine1: address.addressLine1 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    pincode: normalizeIndianPincode(address.pincode ?? ""),
    paymentTerms:
      supplier.paymentTerms ?? supplier.payment_terms ?? PAYMENT_TERM_OPTIONS[1],
    openingBalance: openingBalance ? String(openingBalance) : "",
    notes: supplier.notes ?? "",
  };
};

const hasAnyAddressValue = (form: SupplierFormState) =>
  Boolean(form.addressLine1 || form.city || form.state || form.pincode);

const toSupplierPayload = (form: SupplierFormState): SupplierInput => {
  const includeAddress = hasAnyAddressValue(form);

  return {
    name: form.name.trim(),
    phone: normalizePhoneInput(form.phone),
    email: form.email.trim() || undefined,
    businessName: form.businessName.trim() || undefined,
    gstin: normalizeGstin(form.gstin) || undefined,
    pan: normalizePanInput(form.pan) || undefined,
    supplierAddress: includeAddress
      ? {
          addressLine1: form.addressLine1.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: normalizeIndianPincode(form.pincode),
        }
      : undefined,
    paymentTerms: form.paymentTerms,
    openingBalance: form.openingBalance
      ? Number(form.openingBalance)
      : undefined,
    notes: form.notes.trim() || undefined,
  };
};

const validateSupplierForm = (form: SupplierFormState): SupplierFormErrors => {
  const errors: SupplierFormErrors = {};
  errors.name = validateName(form.name);
  errors.phone = validatePhone(normalizePhoneInput(form.phone));
  errors.email = form.email ? validateEmail(form.email) : "";

  const normalizedGstin = normalizeGstin(form.gstin);
  errors.gstin = form.gstin ? validateGstin(normalizedGstin) : "";
  errors.pan = form.pan ? validatePan(form.pan) : "";

  if (
    !errors.gstin &&
    normalizedGstin &&
    form.state &&
    getStateFromGstin(normalizedGstin) &&
    normalizeIndianState(form.state) &&
    getStateFromGstin(normalizedGstin) !== normalizeIndianState(form.state)
  ) {
    errors.gstin = "GSTIN state code does not match selected state";
  }

  const includeAddress = hasAnyAddressValue(form);
  if (includeAddress) {
    errors.addressLine1 = validateRequired(form.addressLine1);
    errors.city = validateRequired(form.city);
    errors.state = validateIndianState(form.state);
    errors.pincode = validateIndianPincode(form.pincode);
  }

  if (form.openingBalance) {
    const openingBalance = Number(form.openingBalance);
    if (!Number.isFinite(openingBalance)) {
      errors.openingBalance = "Enter a valid number";
    } else if (openingBalance < 0) {
      errors.openingBalance = "Opening balance cannot be negative";
    } else {
      errors.openingBalance = "";
    }
  }

  return errors;
};

const SuppliersClient = ({ name, image }: SuppliersClientProps) => {
  const { t } = useI18n();
  const { data, isLoading, isError } = useSuppliersQuery();
  const createSupplier = useCreateSupplierMutation();
  const updateSupplier = useUpdateSupplierMutation();
  const deleteSupplier = useDeleteSupplierMutation();
  const formAnchorRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState<SupplierFormState>(INITIAL_FORM);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isBusinessSectionOpen, setBusinessSectionOpen] = useState(false);
  const [isAddressSectionOpen, setAddressSectionOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [pincodeHint, setPincodeHint] = useState("");
  const [gstinHint, setGstinHint] = useState("");
  const [isPincodeLookupPending, setPincodeLookupPending] = useState(false);

  const suppliers = useMemo(
    () =>
      (data ?? []).slice().sort((left, right) =>
        resolveSupplierName(left).localeCompare(resolveSupplierName(right), "en-IN", {
          sensitivity: "base",
        }),
      ),
    [data],
  );

  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return suppliers;
    }

    return suppliers.filter((supplier) => {
      const tokens = [
        resolveSupplierName(supplier),
        supplier.phone ?? "",
        supplier.email ?? "",
        supplier.gstin ?? "",
        supplier.pan ?? "",
      ];
      return tokens.join(" ").toLowerCase().includes(query);
    });
  }, [searchQuery, suppliers]);

  const formErrors = useMemo(() => validateSupplierForm(form), [form]);
  const isFormValid = useMemo(
    () => Object.values(formErrors).every((error) => !error),
    [formErrors],
  );

  const withTranslatedValidation =
    (validator: (value: string) => string) => (value: string) =>
      translateValidationMessage(t, validator(value));

  const isMutating =
    createSupplier.isPending ||
    updateSupplier.isPending ||
    deleteSupplier.isPending;

  const scrollToForm = () => {
    formAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setBusinessSectionOpen(false);
    setAddressSectionOpen(false);
    setFormError(null);
    setPincodeHint("");
    setGstinHint("");
  };

  useEffect(() => {
    const normalizedPincode = normalizeIndianPincode(form.pincode);
    if (normalizedPincode.length !== 6) {
      setPincodeLookupPending(false);
      setPincodeHint("");
      return;
    }

    let isMounted = true;

    const resolveAddress = async () => {
      setPincodeLookupPending(true);
      const location = await lookupIndianPincode(normalizedPincode);
      if (!isMounted) {
        return;
      }

      if (location) {
        setForm((previous) => ({
          ...previous,
          city: previous.city || location.city,
          state: previous.state || location.state,
          pincode: normalizedPincode,
        }));
        setPincodeHint(
          t("suppliersPage.smartHints.pincodeSuccess", {
            city: location.city,
            state: location.state,
          }),
        );
      } else {
        setPincodeHint(t("suppliersPage.smartHints.pincodeManual"));
      }

      setPincodeLookupPending(false);
    };

    void resolveAddress();

    return () => {
      isMounted = false;
    };
  }, [form.pincode, t]);

  useEffect(() => {
    const normalized = normalizeGstin(form.gstin);
    if (!normalized) {
      setGstinHint("");
      return;
    }

    const extractedState = getStateFromGstin(normalized);
    if (!extractedState) {
      setGstinHint("");
      return;
    }

    setGstinHint(
      t("suppliersPage.smartHints.gstinState", {
        state: extractedState,
      }),
    );

    setForm((previous) => {
      if (previous.state) {
        return previous;
      }

      return {
        ...previous,
        state: extractedState,
      };
    });
  }, [form.gstin, t]);

  const handleCreateOrUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setListError(null);

    if (!isFormValid) {
      setFormError(t("suppliersPage.messages.formInvalid"));
      return;
    }

    const payload = toSupplierPayload(form);

    try {
      if (editingId) {
        await updateSupplier.mutateAsync({ id: editingId, payload });
      } else {
        await createSupplier.mutateAsync(payload);
      }
      resetForm();
    } catch {
      setFormError(t("suppliersPage.messages.saveError"));
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm(toSupplierForm(supplier));
    setBusinessSectionOpen(
      Boolean(
        supplier.businessName ||
          supplier.business_name ||
          supplier.gstin ||
          supplier.pan,
      ),
    );
    setAddressSectionOpen(
      Boolean(
        supplier.supplierAddress?.addressLine1 ||
          supplier.supplierAddress?.city ||
          supplier.supplierAddress?.state ||
          supplier.supplierAddress?.pincode ||
          supplier.address_line1 ||
          supplier.city ||
          supplier.state ||
          supplier.pincode,
      ),
    );
    setFormError(null);
    scrollToForm();
  };

  const handleDelete = async (supplierId: number) => {
    setListError(null);
    const shouldDelete = window.confirm(t("suppliersPage.messages.confirmDelete"));
    if (!shouldDelete) {
      return;
    }

    try {
      await deleteSupplier.mutateAsync(supplierId);
      if (editingId === supplierId) {
        resetForm();
      }
    } catch {
      setListError(t("suppliersPage.messages.deleteError"));
    }
  };

  const isShowingFilteredResults = Boolean(searchQuery.trim());

  const pincodeHintText = isPincodeLookupPending
    ? t("suppliersPage.smartHints.pincodeLookup")
    : pincodeHint;

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("suppliersPage.title")}
      subtitle={t("suppliersPage.subtitle")}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.22em] text-[#8a6d56]">
            {t("suppliersPage.kicker")}
          </p>
          <p className="max-w-3xl text-base text-[#5c4b3b]">
            {t("suppliersPage.subtitle")}
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div
            ref={formAnchorRef}
            className="rounded-3xl border border-[#ecdccf] bg-[radial-gradient(circle_at_top_right,#fff2de_0%,#fffaf5_42%,#ffffff_100%)] p-5 shadow-[0_35px_70px_-58px_rgba(31,27,22,0.45)] md:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1f1b16]">
                  {editingId
                    ? t("suppliersPage.form.editTitle")
                    : t("suppliersPage.formTitle")}
                </h2>
                <p className="text-sm text-[#8a6d56]">
                  {t("suppliersPage.formDescription")}
                </p>
              </div>
              <span className="rounded-full border border-[#e8d8cb] bg-white px-3 py-1 text-xs font-medium text-[#6b5543]">
                {t("suppliersPage.form.profileTag")}
              </span>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={handleCreateOrUpdate} noValidate>
              <SupplierFormSection
                icon={Contact2}
                title={t("suppliersPage.sections.basic.title")}
                description={t("suppliersPage.sections.basic.description")}
              >
                <ValidationField
                  id="supplier-name"
                  label={t("suppliersPage.fields.name")}
                  value={form.name}
                  onChange={(value) =>
                    setForm((previous) => ({ ...previous, name: value }))
                  }
                  validate={withTranslatedValidation(validateName)}
                  required
                  placeholder={t("suppliersPage.placeholders.name")}
                  success
                />
                <ValidationField
                  id="supplier-phone"
                  label={t("suppliersPage.fields.phone")}
                  value={form.phone}
                  onChange={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      phone: normalizePhoneInput(value),
                    }))
                  }
                  validate={withTranslatedValidation(validatePhone)}
                  required
                  placeholder={t("suppliersPage.placeholders.phone")}
                  inputMode="numeric"
                  maxLength={10}
                  success
                />
                <ValidationField
                  id="supplier-email"
                  label={t("suppliersPage.fields.email")}
                  type="email"
                  value={form.email}
                  onChange={(value) =>
                    setForm((previous) => ({ ...previous, email: value }))
                  }
                  validate={(value) =>
                    value ? withTranslatedValidation(validateEmail)(value) : ""
                  }
                  placeholder={t("suppliersPage.placeholders.email")}
                  success
                />
              </SupplierFormSection>

              <SupplierFormSection
                icon={Building2}
                title={t("suppliersPage.sections.business.title")}
                description={t("suppliersPage.sections.business.description")}
                collapsible
                open={isBusinessSectionOpen}
                onToggle={() => setBusinessSectionOpen((previous) => !previous)}
              >
                <ValidationField
                  id="supplier-business-name"
                  label={t("suppliersPage.fields.businessName")}
                  value={form.businessName}
                  onChange={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      businessName: value,
                    }))
                  }
                  validate={() => ""}
                  placeholder={t("suppliersPage.placeholders.businessName")}
                  success
                />
                <ValidationField
                  id="supplier-gstin"
                  label={t("suppliersPage.fields.gstin")}
                  value={form.gstin}
                  onChange={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      gstin: normalizeGstin(value),
                    }))
                  }
                  validate={(value) => {
                    if (!value) {
                      return "";
                    }
                    const formatError = validateGstin(value);
                    if (formatError) {
                      return formatError;
                    }

                    if (form.state) {
                      const gstState = getStateFromGstin(value);
                      const selectedState = normalizeIndianState(form.state);
                      if (gstState && selectedState && gstState !== selectedState) {
                        return "GSTIN state code does not match selected state";
                      }
                    }

                    return "";
                  }}
                  placeholder={t("suppliersPage.placeholders.gstin")}
                  maxLength={15}
                  success
                />
                <ValidationField
                  id="supplier-pan"
                  label={t("suppliersPage.fields.pan")}
                  value={form.pan}
                  onChange={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      pan: normalizePanInput(value),
                    }))
                  }
                  validate={(value) => (value ? validatePan(value) : "")}
                  placeholder={t("suppliersPage.placeholders.pan")}
                  maxLength={10}
                  success
                />
              </SupplierFormSection>

              <SupplierFormSection
                icon={Truck}
                title={t("suppliersPage.sections.address.title")}
                description={t("suppliersPage.sections.address.description")}
                collapsible
                open={isAddressSectionOpen}
                onToggle={() => setAddressSectionOpen((previous) => !previous)}
              >
                <ValidationField
                  id="supplier-address-line1"
                  label={t("suppliersPage.fields.addressLine1")}
                  value={form.addressLine1}
                  onChange={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      addressLine1: value,
                    }))
                  }
                  validate={(value) =>
                    hasAnyAddressValue(form)
                      ? withTranslatedValidation(validateRequired)(value)
                      : ""
                  }
                  placeholder={t("suppliersPage.placeholders.addressLine1")}
                  success
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ValidationField
                    id="supplier-city"
                    label={t("suppliersPage.fields.city")}
                    value={form.city}
                    onChange={(value) =>
                      setForm((previous) => ({ ...previous, city: value }))
                    }
                    validate={(value) =>
                      hasAnyAddressValue(form)
                        ? withTranslatedValidation(validateRequired)(value)
                        : ""
                    }
                    placeholder={t("suppliersPage.placeholders.city")}
                    success
                  />
                  <ValidationField
                    id="supplier-state"
                    label={t("suppliersPage.fields.state")}
                    as="select"
                    value={form.state}
                    onChange={(value) =>
                      setForm((previous) => ({ ...previous, state: value }))
                    }
                    validate={(value) =>
                      hasAnyAddressValue(form)
                        ? withTranslatedValidation(validateIndianState)(value)
                        : ""
                    }
                    success
                  >
                    <option value="">{t("common.selectOption")}</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </ValidationField>
                </div>
                <ValidationField
                  id="supplier-pincode"
                  label={t("suppliersPage.fields.pincode")}
                  value={form.pincode}
                  onChange={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      pincode: normalizeIndianPincode(value),
                    }))
                  }
                  validate={(value) =>
                    hasAnyAddressValue(form)
                      ? withTranslatedValidation(validateIndianPincode)(value)
                      : ""
                  }
                  placeholder={t("suppliersPage.placeholders.pincode")}
                  inputMode="numeric"
                  maxLength={6}
                  success
                />
              </SupplierFormSection>

              <SupplierFormSection
                icon={CreditCard}
                title={t("suppliersPage.sections.payment.title")}
                description={t("suppliersPage.sections.payment.description")}
              >
                <ValidationField
                  id="supplier-payment-terms"
                  label={t("suppliersPage.fields.paymentTerms")}
                  as="select"
                  value={form.paymentTerms}
                  onChange={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      paymentTerms: value as SupplierPaymentTerms,
                    }))
                  }
                  validate={withTranslatedValidation(validateRequired)}
                  required
                  success
                >
                  {PAYMENT_TERM_OPTIONS.map((term) => (
                    <option key={term} value={term}>
                      {t(`suppliersPage.paymentTerms.${term}`)}
                    </option>
                  ))}
                </ValidationField>

                <ValidationField
                  id="supplier-opening-balance"
                  label={t("suppliersPage.fields.openingBalance")}
                  type="number"
                  value={form.openingBalance}
                  onChange={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      openingBalance: value,
                    }))
                  }
                  validate={(value) => {
                    if (!value) {
                      return "";
                    }
                    const parsed = Number(value);
                    if (!Number.isFinite(parsed)) {
                      return "Enter a valid number";
                    }
                    if (parsed < 0) {
                      return "Opening balance cannot be negative";
                    }
                    return "";
                  }}
                  placeholder={t("suppliersPage.placeholders.openingBalance")}
                  step="0.01"
                  min="0"
                  success
                />

                <div className="grid gap-2">
                  <label
                    htmlFor="supplier-notes"
                    className="text-sm font-medium text-foreground"
                  >
                    {t("suppliersPage.fields.notes")}
                  </label>
                  <textarea
                    id="supplier-notes"
                    rows={3}
                    value={form.notes}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        notes: event.target.value.slice(0, 500),
                      }))
                    }
                    placeholder={t("suppliersPage.placeholders.notes")}
                    className="app-field w-full rounded-xl px-3 py-2 text-sm"
                  />
                  <p className="text-right text-[11px] text-[#8a6d56]">
                    {t("suppliersPage.form.notesCount", {
                      count: String(form.notes.length),
                    })}
                  </p>
                </div>
              </SupplierFormSection>

              <SupplierSmartHints gstinHint={gstinHint} pincodeHint={pincodeHintText} />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                  disabled={!isFormValid || isMutating}
                >
                  {editingId
                    ? t("suppliersPage.actions.updateSupplier")
                    : t("suppliersPage.actions.addSupplier")}
                </Button>
                {editingId ? (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t("suppliersPage.actions.cancelEdit")}
                  </Button>
                ) : null}
              </div>

              {(formError || createSupplier.isError || updateSupplier.isError) && (
                <p className="text-sm text-[#b45309]">
                  {formError ?? t("suppliersPage.messages.saveError")}
                </p>
              )}
            </form>
          </div>

          <div className="rounded-3xl border border-[#ecdccf] bg-white/90 p-5 shadow-[0_28px_55px_-50px_rgba(31,27,22,0.35)] md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1f1b16]">
                  {t("suppliersPage.listTitle")}
                </h2>
                <p className="text-sm text-[#8a6d56]">
                  {t("suppliersPage.listDescription")}
                </p>
              </div>
              <span className="rounded-full border border-[#ecdccf] bg-[#fff9f2] px-3 py-1 text-xs font-medium text-[#6b5543]">
                {t("suppliersPage.form.totalSuppliers", {
                  count: String(suppliers.length),
                })}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#e7d8cc] bg-white px-3 py-2">
              <Search className="h-4 w-4 text-[#8a6d56]" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("suppliersPage.placeholders.search")}
                className="border-0 bg-transparent p-0 focus-visible:ring-0"
              />
            </div>

            <div className="mt-4 space-y-3">
              {isLoading && (
                <p className="text-sm text-[#8a6d56]">{t("suppliersPage.loading")}</p>
              )}

              {isError && (
                <p className="text-sm text-[#b45309]">
                  {t("suppliersPage.messages.loadError")}
                </p>
              )}

              {!isLoading && !isError && suppliers.length === 0 && (
                <FriendlyEmptyState
                  icon={Truck}
                  title={t("suppliersPage.emptyState.title")}
                  description={t("suppliersPage.emptyState.description")}
                  hint={t("suppliersPage.emptyState.hint")}
                  primaryAction={{
                    label: t("suppliersPage.emptyState.action"),
                    onClick: scrollToForm,
                  }}
                />
              )}

              {!isLoading && !isError && suppliers.length > 0 && filteredSuppliers.length === 0 && (
                <p className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-3 py-2 text-sm text-[#8a6d56]">
                  {isShowingFilteredResults
                    ? t("suppliersPage.list.noResults")
                    : t("suppliersPage.empty")}
                </p>
              )}

              {!isLoading && !isError && filteredSuppliers.length > 0 && (
                <div className="grid gap-3">
                  {filteredSuppliers.map((supplier) => (
                    <SupplierListItem
                      key={supplier.id}
                      supplier={supplier}
                      outstandingLabel={t("suppliersPage.list.outstanding")}
                      gstinLabel={t("suppliersPage.list.gstin")}
                      noGstinLabel={t("suppliersPage.list.noGstin")}
                      editLabel={t("suppliersPage.actions.edit")}
                      deleteLabel={t("common.delete")}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      disableDelete={deleteSupplier.isPending}
                    />
                  ))}
                </div>
              )}

              {(listError || deleteSupplier.isError) && (
                <p className="text-sm text-[#b45309]">
                  {listError ?? t("suppliersPage.messages.deleteError")}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default SuppliersClient;
