"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import TemplatePreviewRenderer from "@/components/invoice/TemplatePreviewRenderer";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import LogoUploader from "@/components/business-profile/LogoUploader";
import {
  BUSINESS_TYPES,
  SECTION_LABELS,
  TEMPLATE_CATALOG,
} from "@/lib/invoiceTemplateData";
import { PREVIEW_INVOICE } from "@/lib/invoicePreviewData";
import type {
  BusinessProfileInput,
  SectionKey,
} from "@/types/invoice-template";
import {
  fetchBusinessProfile,
  fetchTemplates,
  saveBusinessProfile,
} from "@/lib/apiClient";

const steps = [
  { id: 1, label: "Business type" },
  { id: 2, label: "Business details" },
  { id: 3, label: "Template" },
];

const BusinessProfileClient = ({
  name,
  image,
}: {
  name: string;
  image?: string;
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [businessTypeId, setBusinessTypeId] = useState("retail");
  const [enabledSections, setEnabledSections] = useState<SectionKey[]>(
    BUSINESS_TYPES[0].defaultSections,
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("minimal");
  const [profile, setProfile] = useState<BusinessProfileInput>({
    businessName: "BillSutra Studio",
    address: "",
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
      toast.success("Business profile saved");
    },
    onError: () => {
      toast.error("Unable to save business profile");
    },
  });

  useEffect(() => {
    if (!businessProfileRecord || profileLoaded) return;
    setProfile((prev) => ({
      ...prev,
      businessName: businessProfileRecord.business_name,
      address: businessProfileRecord.address ?? "",
      phone: businessProfileRecord.phone ?? "",
      email: businessProfileRecord.email ?? "",
      website: businessProfileRecord.website ?? "",
      logoUrl: businessProfileRecord.logo_url ?? "",
      taxId: businessProfileRecord.tax_id ?? "",
      currency: businessProfileRecord.currency ?? prev.currency,
      showLogoOnInvoice: businessProfileRecord.show_logo_on_invoice,
      showTaxNumber: businessProfileRecord.show_tax_number,
      showPaymentQr: businessProfileRecord.show_payment_qr,
    }));
    setProfileLoaded(true);
  }, [businessProfileRecord, profileLoaded]);

  const templates = useMemo(() => {
    if (!templateRecords.length) return TEMPLATE_CATALOG;
    const allowedSections = new Set<SectionKey>(
      Object.keys(SECTION_LABELS) as SectionKey[],
    );
    return templateRecords.map((template) => ({
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
    }));
  }, [templateRecords]);

  const selectedTemplate = useMemo(() => {
    return (
      templates.find((item) => item.id === selectedTemplateId) ?? templates[0]
    );
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!templates.length) return;
    if (!templates.some((item) => item.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const previewData = useMemo(() => {
    return {
      ...PREVIEW_INVOICE,
      business: {
        ...PREVIEW_INVOICE.business,
        ...profile,
      },
    };
  }, [profile]);

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
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFinish = async () => {
    await saveProfileMutation.mutateAsync({
      business_name: profile.businessName,
      address: profile.address,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      logo_url: profile.logoUrl,
      tax_id: profile.taxId,
      currency: profile.currency,
      show_logo_on_invoice: profile.showLogoOnInvoice,
      show_tax_number: profile.showTaxNumber,
      show_payment_qr: profile.showPaymentQr,
    });
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title="Business Profile"
      subtitle="Set up business identity and invoice defaults."
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
              Invoice onboarding
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Set up your billing profile
            </h1>
          </div>
          <ol className="grid w-full gap-2 text-xs sm:w-auto sm:grid-cols-3 sm:gap-3">
            {steps.map((step) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <li
                  key={step.id}
                  aria-current={isActive ? "step" : undefined}
                  className={`flex min-w-[165px] items-center gap-2 rounded-xl border px-3 py-2 transition sm:min-w-[180px] ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : isCompleted
                        ? "border-emerald-200 bg-emerald-50/70"
                        : "border-border bg-white"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "bg-emerald-600 text-white"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.id}
                  </span>
                  <span
                    className={`font-medium uppercase tracking-[0.12em] ${
                      isActive
                        ? "text-primary"
                        : isCompleted
                          ? "text-emerald-700"
                          : "text-[#8a6d56]"
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-border bg-white p-6">
            {currentStep === 1 && (
              <div>
                <h2 className="text-sm font-semibold">
                  Step 1: Choose business type
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {BUSINESS_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleBusinessTypeChange(type.id)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        businessTypeId === type.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-[#5c4b3b] hover:border-primary/50"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl border border-border bg-[#faf6f1] p-4 text-sm text-[#5c4b3b]">
                  <p className="font-semibold">Enabled sections</p>
                  <p className="mt-2 text-xs">
                    {enabledSections
                      .map((section) => SECTION_LABELS[section])
                      .join(", ")}
                  </p>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <h2 className="text-sm font-semibold">
                  Step 2: Business profile
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Business name
                    <input
                      value={profile.businessName}
                      onChange={(event) =>
                        updateProfile("businessName", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-border px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    Phone
                    <input
                      value={profile.phone}
                      onChange={(event) =>
                        updateProfile("phone", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-border px-3 py-2"
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Address
                    <input
                      value={profile.address}
                      onChange={(event) =>
                        updateProfile("address", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-border px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    Email
                    <input
                      value={profile.email}
                      onChange={(event) =>
                        updateProfile("email", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-border px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    Website
                    <input
                      value={profile.website}
                      onChange={(event) =>
                        updateProfile("website", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-border px-3 py-2"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    {/* Logo is stored in localStorage via the hook inside LogoUploader.
                        We intentionally do NOT pipe the Base64 into profile.logoUrl
                        to avoid sending a multi-MB payload to the server API. */}
                    <LogoUploader />
                  </div>
                  <label className="text-sm">
                    Tax ID / GSTIN
                    <input
                      value={profile.taxId}
                      onChange={(event) =>
                        updateProfile("taxId", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-border px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    Currency
                    <input
                      value={profile.currency}
                      onChange={(event) =>
                        updateProfile("currency", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-border px-3 py-2"
                    />
                  </label>
                </div>
                <div className="mt-5 grid gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.showLogoOnInvoice}
                      onChange={() =>
                        updateProfile(
                          "showLogoOnInvoice",
                          !profile.showLogoOnInvoice,
                        )
                      }
                      className="h-4 w-4 rounded border-[#d6c8b8] text-primary"
                    />
                    Show logo on invoice
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.showTaxNumber}
                      onChange={() =>
                        updateProfile("showTaxNumber", !profile.showTaxNumber)
                      }
                      className="h-4 w-4 rounded border-[#d6c8b8] text-primary"
                    />
                    Show tax number
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.showPaymentQr}
                      onChange={() =>
                        updateProfile("showPaymentQr", !profile.showPaymentQr)
                      }
                      className="h-4 w-4 rounded border-[#d6c8b8] text-primary"
                    />
                    Show payment QR
                  </label>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div>
                <h2 className="text-sm font-semibold">
                  Step 3: Template selection
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        selectedTemplateId === template.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div
                        className="h-2 w-10 rounded-full"
                        style={{ backgroundColor: template.theme.primaryColor }}
                      />
                      <p className="mt-3 text-base font-semibold">
                        {template.name}
                      </p>
                      <p className="mt-2 text-xs text-[#5c4b3b]">
                        {template.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 1))}
                className="rounded-full border border-border px-4 py-2 text-sm"
              >
                Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (currentStep === 3) {
                    await handleFinish();
                    return;
                  }
                  setCurrentStep((prev) => Math.min(prev + 1, 3));
                }}
                disabled={saveProfileMutation.isPending}
                className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
              >
                {currentStep === 3
                  ? saveProfileMutation.isPending
                    ? "Saving..."
                    : "Finish"
                  : "Next"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-white p-6">
            <h2 className="text-sm font-semibold">Preview</h2>
            <p className="mt-2 text-xs text-[#8a6d56]">
              Matches the selected template and business profile.
            </p>
            <div className="mt-5 rounded-2xl border border-border bg-white p-2.5">
              <A4PreviewStack
                stackKey={`business-profile-${selectedTemplate.id}-${enabledSections.join(",")}`}
              >
                <TemplatePreviewRenderer
                  key={`${selectedTemplate.id}-${enabledSections.join(",")}`}
                  templateId={selectedTemplate.id}
                  data={previewData}
                  enabledSections={enabledSections}
                  theme={selectedTemplate.theme}
                />
              </A4PreviewStack>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BusinessProfileClient;
