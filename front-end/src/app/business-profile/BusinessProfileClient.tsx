"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Eye,
  LayoutTemplate,
  Palette,
  Sparkles,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import BusinessAddressFields from "@/components/business-profile/BusinessAddressFields";
import LogoUploader from "@/components/business-profile/LogoUploader";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import TemplatePreviewRenderer from "@/components/invoice/TemplatePreviewRenderer";
import { ValidationField } from "@/components/ui/ValidationField";
import { Button } from "@/components/ui/button";
import {
  BUSINESS_TYPES,
  SECTION_LABELS,
  TEMPLATE_CATALOG,
  buildCuratedTemplateList,
  decorateInvoiceTemplate,
} from "@/lib/invoiceTemplateData";
import { PREVIEW_INVOICE } from "@/lib/invoicePreviewData";
import {
  formatBusinessAddress,
  lookupIndianPincode,
  normalizeIndianPincode,
  parseBusinessAddressText,
  toBusinessAddressInput,
} from "@/lib/indianAddress";
import {
  getBusinessProfileValidationErrors,
  getFirstBusinessProfileInvalidField,
  isBusinessProfileRequiredFieldsValid,
  sanitizeBusinessCurrency,
  sanitizeBusinessEmail,
  sanitizeBusinessName,
  sanitizeBusinessNameDraft,
  sanitizeBusinessPhone,
  sanitizeBusinessProfileInput,
  sanitizeBusinessTaxId,
  sanitizeBusinessWebsite,
  validateBusinessCurrency,
  validateBusinessEmail,
  validateBusinessName,
  validateBusinessPhone,
  validateBusinessTaxId,
  validateBusinessWebsite,
} from "@/lib/businessProfileValidation";
import {
  fetchBusinessProfile,
  fetchTemplates,
  saveBusinessProfile,
} from "@/lib/apiClient";
import { useI18n } from "@/providers/LanguageProvider";
import type {
  BusinessProfileInput,
  SectionKey,
} from "@/types/invoice-template";

const BusinessProfileClient = ({
  name,
  image,
}: {
  name: string;
  image?: string;
}) => {
  const { t } = useI18n();
  const [autofillStatus, setAutofillStatus] = useState<{
    tone: "success" | "neutral" | "error";
    message: string;
  } | null>(null);
  const [autofillPending, setAutofillPending] = useState(false);
  const [lastAutofilledPincode, setLastAutofilledPincode] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [businessTypeId, setBusinessTypeId] = useState("retail");
  const [enabledSections, setEnabledSections] = useState<SectionKey[]>(
    BUSINESS_TYPES[0].defaultSections,
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("minimal");
  const [profile, setProfile] = useState<BusinessProfileInput>({
    businessName: "BillSutra Studio",
    address: PREVIEW_INVOICE.business.address,
    businessAddress: {
      addressLine1: "",
      city: "",
      state: "",
      pincode: "",
    },
    phone: "",
    email: "",
    website: "",
    logoUrl: "",
    taxId: "",
    currency: "INR",
    showLogoOnInvoice: true,
    showTaxNumber: true,
    showPaymentQr: false,
  });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const steps = [
    {
      id: 1,
      label: t("businessProfilePage.steps.businessType"),
      accent: "Map the operating model and default invoice sections.",
    },
    {
      id: 2,
      label: t("businessProfilePage.steps.businessDetails"),
      accent: "Organize business details and branding in one polished setup.",
    },
    {
      id: 3,
      label: t("businessProfilePage.steps.template"),
      accent: "Choose the invoice style customers will see.",
    },
  ];

  const { data: templateRecords = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });

  const { data: businessProfileRecord } = useQuery({
    queryKey: ["business-profile"],
    queryFn: fetchBusinessProfile,
  });

  const saveProfileMutation = useMutation({
    mutationFn: saveBusinessProfile,
    onSuccess: () => {
      toast.success(t("businessProfilePage.messages.saved"));
    },
    onError: () => {
      toast.error(t("businessProfilePage.messages.saveError"));
    },
  });

  useEffect(() => {
    if (!businessProfileRecord || profileLoaded) return;

    const parsedLegacyAddress = parseBusinessAddressText(
      businessProfileRecord.address,
    );

    const normalizedBusinessAddress = toBusinessAddressInput({
      addressLine1:
        businessProfileRecord.businessAddress?.addressLine1 ??
        businessProfileRecord.address_line1 ??
        parsedLegacyAddress.addressLine1,
      city:
        businessProfileRecord.businessAddress?.city ??
        businessProfileRecord.city ??
        parsedLegacyAddress.city,
      state:
        businessProfileRecord.businessAddress?.state ??
        businessProfileRecord.state ??
        parsedLegacyAddress.state,
      pincode:
        businessProfileRecord.businessAddress?.pincode ??
        businessProfileRecord.pincode ??
        parsedLegacyAddress.pincode,
    });

    setProfile((prev) =>
      sanitizeBusinessProfileInput({
        ...prev,
        businessName: businessProfileRecord.business_name,
        address: formatBusinessAddress(
          normalizedBusinessAddress,
          businessProfileRecord.address,
        ),
        businessAddress: normalizedBusinessAddress,
        phone: businessProfileRecord.phone ?? "",
        email: businessProfileRecord.email ?? "",
        website: businessProfileRecord.website ?? "",
        logoUrl: businessProfileRecord.logo_url ?? "",
        taxId: businessProfileRecord.tax_id ?? "",
        currency: businessProfileRecord.currency ?? prev.currency,
        showLogoOnInvoice: businessProfileRecord.show_logo_on_invoice,
        showTaxNumber: businessProfileRecord.show_tax_number,
        showPaymentQr: businessProfileRecord.show_payment_qr,
      }),
    );
    setProfileLoaded(true);
  }, [businessProfileRecord, profileLoaded]);

  useEffect(() => {
    const pincode = profile.businessAddress?.pincode ?? "";
    if (pincode.length !== 6 || pincode === lastAutofilledPincode) {
      return;
    }

    let isCancelled = false;
    setAutofillPending(true);

    lookupIndianPincode(pincode)
      .then((result) => {
        if (isCancelled) return;

        if (result) {
          setProfile((prev) => {
            const currentAddress = toBusinessAddressInput(prev.businessAddress);
            const nextAddress = toBusinessAddressInput({
              ...currentAddress,
              city: currentAddress.city || result.city,
              state: currentAddress.state || result.state,
            });

            return {
              ...prev,
              businessAddress: nextAddress,
              address: formatBusinessAddress(nextAddress, prev.address),
            };
          });

          setAutofillStatus({
            tone: "success",
            message: t("businessProfilePage.messages.autofillSuccess"),
          });
          return;
        }

        setAutofillStatus({
          tone: "neutral",
          message: t("businessProfilePage.messages.autofillFallback"),
        });
      })
      .catch(() => {
        if (isCancelled) return;
        setAutofillStatus({
          tone: "error",
          message: t("businessProfilePage.messages.autofillError"),
        });
      })
      .finally(() => {
        if (isCancelled) return;
        setAutofillPending(false);
        setLastAutofilledPincode(pincode);
      });

    return () => {
      isCancelled = true;
    };
  }, [lastAutofilledPincode, profile.businessAddress?.pincode, t]);

  const templates = useMemo(() => {
    if (!templateRecords.length) return TEMPLATE_CATALOG;
    const allowedSections = new Set<SectionKey>(
      Object.keys(SECTION_LABELS) as SectionKey[],
    );
    const normalizedTemplates = templateRecords.map((template) =>
      decorateInvoiceTemplate({
        id: String(template.id),
        name: template.name,
        description: template.description ?? "",
        layout: template.layout_config.layout,
        defaultSections: (template.sections ?? [])
          .filter((section) => section.is_default)
          .sort((a, b) => a.section_order - b.section_order)
          .map((section) => section.section_key)
          .filter((section): section is SectionKey =>
            allowedSections.has(section as SectionKey),
          ),
        theme: {
          primaryColor: template.layout_config.primaryColor,
          fontFamily: "var(--font-geist-sans)",
          tableStyle: template.layout_config.tableStyle,
        },
      }),
    );

    return buildCuratedTemplateList(normalizedTemplates);
  }, [templateRecords]);

  const selectedTemplate = useMemo(
    () =>
      templates.find((item) => item.id === selectedTemplateId) ?? templates[0],
    [selectedTemplateId, templates],
  );

  const selectedBusinessType = useMemo(
    () =>
      BUSINESS_TYPES.find((item) => item.id === businessTypeId) ??
      BUSINESS_TYPES[0],
    [businessTypeId],
  );

  useEffect(() => {
    if (!templates.length) return;
    if (!templates.some((item) => item.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const previewData = useMemo(
    () => ({
      ...PREVIEW_INVOICE,
      business: {
        ...PREVIEW_INVOICE.business,
        ...profile,
        businessAddress: toBusinessAddressInput(profile.businessAddress),
        address: formatBusinessAddress(
          profile.businessAddress,
          profile.address,
        ),
      },
    }),
    [profile],
  );

  const businessProfileErrors = useMemo(
    () => getBusinessProfileValidationErrors(profile),
    [profile],
  );
  const isBusinessDetailsStepValid = useMemo(
    () => isBusinessProfileRequiredFieldsValid(businessProfileErrors),
    [businessProfileErrors],
  );

  const handleBusinessTypeChange = (value: string) => {
    setBusinessTypeId(value);
    const matched = BUSINESS_TYPES.find((type) => type.id === value);
    if (matched) {
      setEnabledSections(matched.defaultSections);
    }
  };

  const updateProfile = (
    field: keyof BusinessProfileInput,
    value: string | boolean,
  ) => {
    const nextValue =
      typeof value === "string"
        ? field === "businessName"
          ? sanitizeBusinessNameDraft(value)
          : field === "phone"
            ? sanitizeBusinessPhone(value)
            : value
        : value;

    setProfile((prev) => ({
      ...prev,
      [field]: nextValue,
    }));
  };

  const updateBusinessAddressField = (
    field: "addressLine1" | "city" | "state" | "pincode",
    value: string,
  ) => {
    setProfile((prev) => {
      const nextAddress = toBusinessAddressInput({
        ...prev.businessAddress,
        [field]: field === "pincode" ? normalizeIndianPincode(value) : value,
      });

      return {
        ...prev,
        businessAddress: nextAddress,
        address: formatBusinessAddress(nextAddress, prev.address),
      };
    });

    if (field === "pincode") {
      const normalized = normalizeIndianPincode(value);
      if (normalized.length < 6) {
        setAutofillStatus(null);
        setAutofillPending(false);
        setLastAutofilledPincode("");
      }
    }
  };

  const handleAddressPaste = (rawText: string) => {
    const parsed = parseBusinessAddressText(rawText);

    if (
      !parsed.addressLine1 &&
      !parsed.city &&
      !parsed.state &&
      !parsed.pincode
    ) {
      return;
    }

    setProfile((prev) => {
      const nextAddress = toBusinessAddressInput({
        ...prev.businessAddress,
        ...parsed,
        addressLine1:
          parsed.addressLine1 ??
          toBusinessAddressInput(prev.businessAddress).addressLine1,
      });

      return {
        ...prev,
        businessAddress: nextAddress,
        address: formatBusinessAddress(nextAddress, rawText || prev.address),
      };
    });

    setAutofillStatus(null);
  };

  const focusFirstInvalidBusinessProfileField = () => {
    const firstInvalidFieldId =
      getFirstBusinessProfileInvalidField(businessProfileErrors);
    if (!firstInvalidFieldId) {
      return;
    }

    const field = document.getElementById(firstInvalidFieldId);
    if (field instanceof HTMLElement) {
      field.focus();
    }
  };

  const handleFinish = async () => {
    setSubmitAttempted(true);
    if (!isBusinessDetailsStepValid) {
      focusFirstInvalidBusinessProfileField();
      return;
    }

    const sanitizedProfile = sanitizeBusinessProfileInput(profile);
    setProfile(sanitizedProfile);

    const normalizedBusinessAddress = toBusinessAddressInput(
      sanitizedProfile.businessAddress,
    );

    const legacyAddress = formatBusinessAddress(
      normalizedBusinessAddress,
      sanitizedProfile.address,
    );

    try {
      await saveProfileMutation.mutateAsync({
        business_name: sanitizedProfile.businessName,
        businessAddress: normalizedBusinessAddress,
        address_line1: normalizedBusinessAddress.addressLine1,
        city: normalizedBusinessAddress.city,
        state: normalizedBusinessAddress.state,
        pincode: normalizedBusinessAddress.pincode,
        address: legacyAddress,
        phone: sanitizedProfile.phone,
        email: sanitizedProfile.email,
        website: sanitizedProfile.website,
        logo_url: sanitizedProfile.logoUrl,
        tax_id: sanitizedProfile.taxId,
        currency: sanitizedProfile.currency,
        show_logo_on_invoice: sanitizedProfile.showLogoOnInvoice,
        show_tax_number: sanitizedProfile.showTaxNumber,
        show_payment_qr: sanitizedProfile.showPaymentQr,
      });
      setSubmitAttempted(false);
    } catch {
      // Toasts are handled in mutation callbacks.
    }
  };

  const toggleOptions = [
    {
      key: "showLogoOnInvoice" as const,
      label: t("businessProfilePage.toggles.showLogoOnInvoice"),
      description: t(
        "businessProfilePage.toggleDescriptions.showLogoOnInvoice",
      ),
    },
    {
      key: "showTaxNumber" as const,
      label: t("businessProfilePage.toggles.showTaxNumber"),
      description: t("businessProfilePage.toggleDescriptions.showTaxNumber"),
    },
    {
      key: "showPaymentQr" as const,
      label: t("businessProfilePage.toggles.showPaymentQr"),
      description: t("businessProfilePage.toggleDescriptions.showPaymentQr"),
    },
  ];

  const currentStepSummary =
    steps.find((step) => step.id === currentStep) ?? steps[0];

  const renderLeftPanel = () => {
    if (currentStep === 1) {
      return (
        <section className="rounded-[2rem] border border-white/70 bg-white/92 p-6 shadow-[0_30px_90px_-65px_rgba(17,37,63,0.55)] backdrop-blur sm:p-7">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d7e4f1] bg-[#f8fbff] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#7f95ab]">
              <Sparkles className="h-3.5 w-3.5" />
              {t("businessProfilePage.content.setupBadge")}
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-[#10233f]">
              {t("businessProfilePage.stepTitles.businessType")}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-[#627890]">
              {t("businessProfilePage.content.businessTypeDescription")}
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {BUSINESS_TYPES.map((type) => {
              const active = businessTypeId === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleBusinessTypeChange(type.id)}
                  className={[
                    "rounded-[1.5rem] border px-5 py-5 text-left transition-all duration-200",
                    active
                      ? "border-[#123d65] bg-[linear-gradient(180deg,#eef6ff_0%,#f8fbff_100%)] shadow-[0_24px_50px_-38px_rgba(17,37,63,0.45)]"
                      : "border-[#d7e4f1] bg-white hover:border-[#7aa8d6] hover:bg-[#f9fbff]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-[#10233f]">
                        {type.label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#627890]">
                        {t(
                          "businessProfilePage.content.businessTypeCardDescription",
                        )}
                      </p>
                    </div>
                    <span
                      className={[
                        "mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                        active
                          ? "border-[#123d65] bg-[#123d65] text-white"
                          : "border-[#d7e4f1] bg-white text-[#7f95ab]",
                      ].join(" ")}
                    >
                      {active ? <CheckCircle2 className="h-4 w-4" /> : "."}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      );
    }

    if (currentStep === 3) {
      return (
        <section className="rounded-[2rem] border border-white/70 bg-white/92 p-6 shadow-[0_30px_90px_-65px_rgba(17,37,63,0.55)] backdrop-blur sm:p-7">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d7e4f1] bg-[#f8fbff] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#7f95ab]">
              <LayoutTemplate className="h-3.5 w-3.5" />
              {t("businessProfilePage.content.templateBadge")}
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-[#10233f]">
              {t("businessProfilePage.stepTitles.templateSelection")}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-[#627890]">
              {t("businessProfilePage.content.templateDescription")}
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {templates.map((template) => {
              const selected = selectedTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={[
                    "rounded-[1.5rem] border px-5 py-5 text-left transition-all duration-200",
                    selected
                      ? "border-[#123d65] bg-[linear-gradient(180deg,#eef6ff_0%,#f8fbff_100%)] shadow-[0_24px_50px_-38px_rgba(17,37,63,0.45)]"
                      : "border-[#d7e4f1] bg-white hover:border-[#7aa8d6] hover:bg-[#f9fbff]",
                  ].join(" ")}
                >
                  <div
                    className="h-2.5 w-16 rounded-full"
                    style={{ backgroundColor: template.theme.primaryColor }}
                  />
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-[#10233f]">
                        {template.name}
                      </p>
                      {template.bestFor ? (
                        <p className="mt-2 inline-flex rounded-full bg-[#edf5fb] px-2.5 py-1 text-[11px] font-medium text-[#123d65]">
                          {template.bestFor}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm leading-6 text-[#627890]">
                        {template.description}
                      </p>
                    </div>
                    {selected ? (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#123d65] text-white">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      );
    }

    return (
      <section className="rounded-[2rem] border border-white/70 bg-white/92 p-6 shadow-[0_30px_90px_-65px_rgba(17,37,63,0.55)] backdrop-blur sm:p-7">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d7e4f1] bg-[#f8fbff] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#7f95ab]">
            <Building2 className="h-3.5 w-3.5" />
            {t("businessProfilePage.content.detailsBadge")}
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-[#10233f]">
            {t("businessProfilePage.content.detailsTitle")}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-[#627890]">
            {t("businessProfilePage.content.detailsDescription")}
          </p>
        </div>

        <div className="mt-7 grid gap-x-5 gap-y-5 md:grid-cols-2">
          <ValidationField
            id="businessName"
            label={t("businessProfilePage.fields.businessName")}
            value={profile.businessName}
            onChange={(value) => updateProfile("businessName", value)}
            normalizeOnBlur={sanitizeBusinessName}
            validate={validateBusinessName}
            required
            placeholder={t("businessProfilePage.placeholders.businessName")}
            success
            forceTouched={submitAttempted}
            maxLength={100}
            className="mb-0"
          />
          <ValidationField
            id="phone"
            label={t("businessProfilePage.fields.phone")}
            value={profile.phone}
            onChange={(value) => updateProfile("phone", value)}
            normalizeOnBlur={sanitizeBusinessPhone}
            validate={validateBusinessPhone}
            required
            placeholder={t("businessProfilePage.placeholders.phone")}
            success
            forceTouched={submitAttempted}
            inputMode="tel"
            maxLength={10}
            className="mb-0"
          />
          <BusinessAddressFields
            value={toBusinessAddressInput(profile.businessAddress)}
            onFieldChange={updateBusinessAddressField}
            onFieldBlur={() => undefined}
            onAddressPaste={handleAddressPaste}
            autofillStatus={autofillStatus}
            autofillPending={autofillPending}
            forceTouched={submitAttempted}
          />
          <ValidationField
            id="email"
            label={t("businessProfilePage.fields.email")}
            value={profile.email}
            onChange={(value) => updateProfile("email", value)}
            normalizeOnBlur={sanitizeBusinessEmail}
            validate={validateBusinessEmail}
            required
            placeholder={t("businessProfilePage.placeholders.email")}
            success
            forceTouched={submitAttempted}
            type="email"
            inputMode="email"
            maxLength={254}
            className="mb-0"
          />
          <ValidationField
            id="website"
            label={t("businessProfilePage.fields.website")}
            value={profile.website}
            onChange={(value) => updateProfile("website", value)}
            normalizeOnBlur={sanitizeBusinessWebsite}
            validate={validateBusinessWebsite}
            placeholder={t("businessProfilePage.placeholders.website")}
            success
            forceTouched={submitAttempted}
            type="url"
            inputMode="url"
            maxLength={2048}
            className="mb-0"
          />
          <ValidationField
            id="taxId"
            label={t("businessProfilePage.fields.taxId")}
            value={profile.taxId}
            onChange={(value) => updateProfile("taxId", value)}
            normalizeOnBlur={sanitizeBusinessTaxId}
            validate={validateBusinessTaxId}
            placeholder={t("businessProfilePage.placeholders.taxId")}
            success
            forceTouched={submitAttempted}
            maxLength={15}
            className="mb-0"
          />
          <ValidationField
            id="currency"
            label={t("businessProfilePage.fields.currency")}
            value={profile.currency}
            onChange={(value) => updateProfile("currency", value)}
            normalizeOnBlur={sanitizeBusinessCurrency}
            validate={validateBusinessCurrency}
            required
            placeholder={t("businessProfilePage.placeholders.currency")}
            success
            forceTouched={submitAttempted}
            maxLength={3}
            className="mb-0"
          />
        </div>
      </section>
    );
  };

  const renderRightTopCard = () => {
    if (currentStep === 1) {
      return (
        <section className="rounded-[2rem] border border-white/70 bg-white/92 p-6 shadow-[0_30px_90px_-65px_rgba(17,37,63,0.55)] backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf5fb] text-[#123d65]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#10233f]">
                {t("businessProfilePage.content.enabledSectionsTitle")}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#627890]">
                {t("businessProfilePage.content.enabledSectionsDescription", {
                  label: selectedBusinessType.label,
                })}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {enabledSections.map((section) => (
              <span
                key={section}
                className="inline-flex rounded-full border border-[#d7e4f1] bg-[#f8fbff] px-3 py-1.5 text-xs font-medium text-[#4f6882]"
              >
                {SECTION_LABELS[section]}
              </span>
            ))}
          </div>
        </section>
      );
    }

    if (currentStep === 3) {
      return (
        <section className="rounded-[2rem] border border-white/70 bg-white/92 p-6 shadow-[0_30px_90px_-65px_rgba(17,37,63,0.55)] backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf5fb] text-[#123d65]">
              <Palette className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#10233f]">
                {t("businessProfilePage.content.selectedStyleTitle")}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#627890]">
                {t("businessProfilePage.content.selectedStyleDescription", {
                  name:
                    selectedTemplate?.name ??
                    t("businessProfilePage.templateFallback"),
                })}
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-[#d7e4f1] bg-[#f8fbff] p-4">
            <div
              className="h-2.5 w-20 rounded-full"
              style={{ backgroundColor: selectedTemplate?.theme.primaryColor }}
            />
            <p className="mt-4 text-base font-semibold text-[#10233f]">
              {selectedTemplate?.name ??
                t("businessProfilePage.templateFallback")}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#627890]">
              {selectedTemplate?.description ??
                t("businessProfilePage.content.selectedStyleFallback")}
            </p>
          </div>
        </section>
      );
    }

    return (
      <section className="rounded-[2rem] border border-white/70 bg-white/92 p-6 shadow-[0_30px_90px_-65px_rgba(17,37,63,0.55)] backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf5fb] text-[#123d65]">
            <Palette className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#10233f]">
              {t("businessProfilePage.content.brandingTitle")}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#627890]">
              {t("businessProfilePage.content.brandingDescription")}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <LogoUploader />
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-[#d7e4f1] bg-[#f8fbff] p-4">
          <p className="text-sm font-semibold text-[#10233f]">
            {t("businessProfilePage.content.brandingControlsTitle")}
          </p>
          <div className="mt-4 space-y-3">
            {toggleOptions.map((option) => (
              <label
                key={option.key}
                className="flex items-start gap-3 rounded-[1.2rem] border border-white/80 bg-white/90 p-3.5 shadow-[0_18px_36px_-34px_rgba(17,37,63,0.45)]"
              >
                <input
                  type="checkbox"
                  checked={profile[option.key]}
                  onChange={() =>
                    updateProfile(option.key, !profile[option.key])
                  }
                  className="mt-1 h-4 w-4 rounded border-[#b9d1e6] text-[#123d65] accent-[#123d65]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#10233f]">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[#627890]">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const actionDisabled =
    saveProfileMutation.isPending ||
    (currentStep === 2 && !isBusinessDetailsStepValid) ||
    (currentStep === 3 && !isBusinessDetailsStepValid);

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("businessProfilePage.title")}
      subtitle={t("businessProfilePage.subtitle")}
    >
      <div className="mx-auto w-full max-w-[1280px] space-y-6">
        <section className="rounded-[2rem] border border-white/75 bg-white/78 p-6 shadow-[0_28px_90px_-70px_rgba(17,37,63,0.55)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="app-kicker">{t("businessProfilePage.kicker")}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#10233f] sm:text-[2.4rem]">
                {t("businessProfilePage.heading")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#627890] sm:text-[0.98rem]">
                {currentStepSummary.accent}
              </p>
            </div>

            <ol className="grid gap-3 sm:grid-cols-3">
              {steps.map((step) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <li
                    key={step.id}
                    aria-current={isActive ? "step" : undefined}
                    className={[
                      "min-w-[180px] rounded-[1.45rem] border px-4 py-3 transition-all duration-200",
                      isActive
                        ? "border-[#123d65] bg-[#eef6ff] shadow-[0_20px_40px_-34px_rgba(17,37,63,0.4)]"
                        : isCompleted
                          ? "border-emerald-200 bg-emerald-50/80"
                          : "border-[#d7e4f1] bg-white/85",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                          isActive
                            ? "bg-[#123d65] text-white"
                            : isCompleted
                              ? "bg-emerald-600 text-white"
                              : "bg-[#edf5fb] text-[#7f95ab]",
                        ].join(" ")}
                      >
                        {step.id}
                      </span>
                      <span
                        className={[
                          "text-[0.72rem] font-semibold uppercase tracking-[0.22em]",
                          isActive
                            ? "text-[#123d65]"
                            : isCompleted
                              ? "text-emerald-700"
                              : "text-[#7f95ab]",
                        ].join(" ")}
                      >
                        {step.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.98fr)]">
          <div className="space-y-6">
            {renderLeftPanel()}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.8rem] border border-white/75 bg-white/78 px-5 py-4 shadow-[0_24px_70px_-60px_rgba(17,37,63,0.48)] backdrop-blur-xl">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-[#d7e4f1] bg-white/90 px-5"
                onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 1))}
                disabled={currentStep === 1}
              >
                {t("businessProfilePage.actions.back")}
              </Button>
              <Button
                type="button"
                className="rounded-full px-6"
                onClick={async () => {
                  if (currentStep === 2 && !isBusinessDetailsStepValid) {
                    setSubmitAttempted(true);
                    focusFirstInvalidBusinessProfileField();
                    return;
                  }
                  if (currentStep === 3) {
                    await handleFinish();
                    return;
                  }
                  setCurrentStep((prev) => Math.min(prev + 1, 3));
                }}
                disabled={actionDisabled}
                aria-disabled={actionDisabled}
              >
                {currentStep === 3
                  ? saveProfileMutation.isPending
                    ? t("businessProfilePage.actions.saving")
                    : t("businessProfilePage.actions.finish")
                  : t("businessProfilePage.actions.next")}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {renderRightTopCard()}

            <section className="rounded-[2rem] border border-white/70 bg-white/92 p-6 shadow-[0_30px_90px_-65px_rgba(17,37,63,0.55)] backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf5fb] text-[#123d65]">
                  <Eye className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#10233f]">
                    {t("businessProfilePage.previewTitle")}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#627890]">
                    {t("businessProfilePage.previewDescription")}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.65rem] border border-[#d7e4f1] bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div className="max-h-[72rem] overflow-auto rounded-[1.35rem] border border-white/80 bg-white/92 p-2 shadow-[0_28px_55px_-50px_rgba(17,37,63,0.5)]">
                  <A4PreviewStack
                    stackKey={`business-profile-${selectedTemplate?.id ?? "template"}-${enabledSections.join(",")}`}
                  >
                    <TemplatePreviewRenderer
                      key={`${selectedTemplate?.id ?? "template"}-${enabledSections.join(",")}`}
                      templateId={selectedTemplate?.id}
                      templateName={selectedTemplate?.name}
                      data={previewData}
                      enabledSections={enabledSections}
                      theme={
                        selectedTemplate?.theme ?? {
                          primaryColor: "#123d65",
                          fontFamily: "var(--font-geist-sans)",
                          tableStyle: "minimal",
                        }
                      }
                    />
                  </A4PreviewStack>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BusinessProfileClient;
