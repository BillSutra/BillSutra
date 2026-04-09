"use client";

import type { ChangeEvent, DragEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, GripVertical } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import TemplatePreviewRenderer from "@/components/invoice/TemplatePreviewRenderer";
import A4PreviewStack, {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
} from "@/components/invoice/A4PreviewStack";
import {
  DesignConfigProvider,
  createDesignConfig,
  getDefaultSectionConfig,
  normalizeDesignConfig,
  type DesignConfig,
  type SectionStyleConfig,
} from "@/components/invoice/DesignConfigContext";
import {
  BUSINESS_TYPES,
  SECTION_LABELS,
  TEMPLATE_CATALOG,
  buildCuratedTemplateList,
  decorateInvoiceTemplate,
  resolveInvoiceTemplatePreset,
} from "@/lib/invoiceTemplateData";
import {
  DEFAULT_ACTIVE_INVOICE_TEMPLATE,
  resolveActiveInvoiceTemplate,
  saveActiveInvoiceTemplate,
} from "@/lib/invoiceActiveTemplate";
import { PREVIEW_INVOICE } from "@/lib/invoicePreviewData";
import type { InvoiceTemplateConfig, SectionKey } from "@/types/invoice-template";
import {
  createUserSavedTemplate,
  deleteUserSavedTemplate,
  fetchBusinessProfile,
  fetchTemplates,
  fetchUserSavedTemplates,
  fetchUserTemplates,
  saveUserTemplate,
  updateUserSavedTemplate,
} from "@/lib/apiClient";
import { useInvoicePdf } from "@/hooks/invoice/useInvoicePdf";
import { useI18n } from "@/providers/LanguageProvider";

const MemoTemplatePreview = memo(TemplatePreviewRenderer);

const FONT_OPTIONS = [
  { label: "Geist Sans", value: "var(--font-geist-sans)" },
  { label: "Sora", value: "var(--font-sora)" },
  { label: "Fraunces", value: "var(--font-fraunces)" },
  { label: "Geist Mono", value: "var(--font-geist-mono)" },
  {
    label: "Segoe UI",
    value: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  {
    label: "Trebuchet",
    value: '"Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", sans-serif',
  },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
] as const;

const COLOR_PRESETS = [
  "#2563eb",
  "#0f766e",
  "#7c3aed",
  "#dc2626",
  "#ea580c",
  "#16a34a",
  "#111827",
  "#475569",
  "#ffffff",
  "#0b1120",
] as const;

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

const normalizeHexColor = (value: string) => {
  const normalized = value.trim();
  if (HEX_COLOR_REGEX.test(normalized)) {
    return normalized.toLowerCase();
  }
  return null;
};

const matchesTemplateIdentity = (
  template: InvoiceTemplateConfig,
  templateId?: string | null,
  templateName?: string | null,
) => {
  if (template.id === templateId) {
    return true;
  }

  if (
    templateName &&
    template.name.toLowerCase() === templateName.trim().toLowerCase()
  ) {
    return true;
  }

  const templatePreset = resolveInvoiceTemplatePreset(template.id, template.name);
  const activePreset = resolveInvoiceTemplatePreset(templateId, templateName);

  return Boolean(
    templatePreset &&
      activePreset &&
      templatePreset.variant === activePreset.variant,
  );
};

const TemplatesClient = ({ name, image }: { name: string; image?: string }) => {
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const [businessTypeId, setBusinessTypeId] = useState("retail");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    DEFAULT_ACTIVE_INVOICE_TEMPLATE.templateId,
  );
  const [enabledSections, setEnabledSections] = useState<SectionKey[]>(
    BUSINESS_TYPES[0].defaultSections,
  );
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(
    BUSINESS_TYPES[0].defaultSections,
  );
  const [themeColor, setThemeColor] = useState("#2563eb");
  const [showLogo, setShowLogo] = useState(true);
  const [pendingAutoSave, setPendingAutoSave] = useState<SectionKey[] | null>(
    null,
  );
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(
    null,
  );
  const [previewEnabledSections, setPreviewEnabledSections] = useState<
    SectionKey[]
  >([]);
  const [previewSectionOrder, setPreviewSectionOrder] = useState<SectionKey[]>(
    [],
  );
  const [previewThemeColor, setPreviewThemeColor] = useState("#2563eb");
  const [previewShowLogo, setPreviewShowLogo] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTemplateHydratedRef = useRef(false);
  const [draggedSection, setDraggedSection] = useState<SectionKey | null>(null);
  const [draggedPreviewSection, setDraggedPreviewSection] =
    useState<SectionKey | null>(null);
  const [openBusinessType, setOpenBusinessType] = useState(true);
  const [openTemplateSelection, setOpenTemplateSelection] = useState(true);
  const [openCustomize, setOpenCustomize] = useState(true);
  const [openDesignPanel, setOpenDesignPanel] = useState(true);
  const [openLivePreview, setOpenLivePreview] = useState(true);
  const [designConfig, setDesignConfig] = useState(() => createDesignConfig());
  const [activeDesignSection, setActiveDesignSection] =
    useState<SectionKey>("header");
  const [savedTemplateSearch, setSavedTemplateSearch] = useState("");
  const [savedTemplateFilter, setSavedTemplateFilter] = useState<
    "all" | "current-template"
  >("all");
  const [themeHexInput, setThemeHexInput] = useState("#2563eb");
  const [backgroundHexInput, setBackgroundHexInput] = useState("#ffffff");
  const [textHexInput, setTextHexInput] = useState("#334155");

  const { data: templateRecords = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });

  const { data: userTemplateRecords = [] } = useQuery({
    queryKey: ["user-templates"],
    queryFn: fetchUserTemplates,
  });

  const { data: userSavedTemplates = [] } = useQuery({
    queryKey: ["user-saved-templates"],
    queryFn: fetchUserSavedTemplates,
  });

  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: fetchBusinessProfile,
  });

  const { downloadPdf } = useInvoicePdf();

  const saveTemplateMutation = useMutation({
    mutationFn: saveUserTemplate,
    onSuccess: (savedTemplate) => {
      queryClient.setQueryData(
        ["user-templates"],
        (previous: typeof userTemplateRecords | undefined) => {
          if (!previous?.length) return [savedTemplate];
          const hasExisting = previous.some(
            (item) => item.template_id === savedTemplate.template_id,
          );
          if (hasExisting) {
            return previous.map((item) =>
              item.template_id === savedTemplate.template_id
                ? savedTemplate
                : item,
            );
          }
          return [savedTemplate, ...previous];
        },
      );
      toast.success(t("templatesPage.toasts.settingsSaved"));
    },
    onError: () => {
      toast.error(t("templatesPage.toasts.settingsSaveError"));
    },
  });

  const createSavedTemplateMutation = useMutation({
    mutationFn: createUserSavedTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-saved-templates"] });
      toast.success(t("templatesPage.toasts.savedCreated"));
    },
    onError: () => {
      toast.error(t("templatesPage.toasts.savedCreateError"));
    },
  });

  const updateSavedTemplateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof updateUserSavedTemplate>[1];
    }) => updateUserSavedTemplate(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-saved-templates"] });
      toast.success(t("templatesPage.toasts.savedUpdated"));
    },
    onError: () => {
      toast.error(t("templatesPage.toasts.savedUpdateError"));
    },
  });

  const deleteSavedTemplateMutation = useMutation({
    mutationFn: deleteUserSavedTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-saved-templates"] });
      toast.success(t("templatesPage.toasts.savedDeleted"));
    },
    onError: () => {
      toast.error(t("templatesPage.toasts.savedDeleteError"));
    },
  });

  const knownSections = useMemo(
    () => new Set<SectionKey>(Object.keys(SECTION_LABELS) as SectionKey[]),
    [],
  );

  const normalizeSection = useCallback(
    (section: string): SectionKey | null => {
      return knownSections.has(section as SectionKey)
        ? (section as SectionKey)
        : null;
    },
    [knownSections],
  );

  const templatesFromApi = useMemo(() => {
    if (!templateRecords.length) return null;

    const mapFontFamily = (font: string) => {
      const value = font.toLowerCase();
      if (value.includes("sora")) return "var(--font-sora)";
      if (value.includes("fraunces")) return "var(--font-fraunces)";
      if (value.includes("mono")) return "var(--font-geist-mono)";
      return "var(--font-geist-sans)";
    };

    return templateRecords.map((template) => {
      const orderedSections = (template.sections ?? [])
        .slice()
        .sort((a, b) => a.section_order - b.section_order)
        .map((section) => normalizeSection(section.section_key))
        .filter((section): section is SectionKey => Boolean(section));
      const defaultSections = (template.sections ?? [])
        .filter((section) => section.is_default)
        .sort((a, b) => a.section_order - b.section_order)
        .map((section) => normalizeSection(section.section_key))
        .filter((section): section is SectionKey => Boolean(section));

      return decorateInvoiceTemplate({
        id: String(template.id),
        name: template.name,
        description: template.description ?? "",
        layout: template.layout_config.layout,
        defaultSections: defaultSections.length
          ? defaultSections
          : orderedSections,
        theme: {
          primaryColor: template.layout_config.primaryColor,
          fontFamily: mapFontFamily(template.layout_config.font),
          tableStyle: template.layout_config.tableStyle,
        },
        sectionOrder: orderedSections.length
          ? orderedSections
          : defaultSections,
      });
    });
  }, [templateRecords, normalizeSection]);

  const templates = templatesFromApi ?? TEMPLATE_CATALOG;
  const featuredTemplates = useMemo(() => {
    return buildCuratedTemplateList(templates);
  }, [templates]);
  const templateCatalog = featuredTemplates.length ? featuredTemplates : templates;

  const selectedTemplate = useMemo(() => {
    return (
      templateCatalog.find((item) => item.id === selectedTemplateId) ??
      featuredTemplates.find((item) => item.id === selectedTemplateId) ??
      templates.find((item) => item.id === selectedTemplateId) ??
      templateCatalog[0] ??
      featuredTemplates[0] ??
      templates[0]
    );
  }, [featuredTemplates, selectedTemplateId, templateCatalog, templates]);

  const previewTemplate = useMemo(() => {
    if (!previewTemplateId) return null;
    return (
      templateCatalog.find((item) => item.id === previewTemplateId) ??
      templates.find((item) => item.id === previewTemplateId) ??
      null
    );
  }, [previewTemplateId, templateCatalog, templates]);

  useEffect(() => {
    if (!templateCatalog.length) return;
    if (!templateCatalog.some((item) => item.id === selectedTemplateId)) {
      setSelectedTemplateId(templateCatalog[0].id);
      setThemeColor(templateCatalog[0].theme.primaryColor);
    }
  }, [selectedTemplateId, templateCatalog]);

  useEffect(() => {
    if (!templates.length || activeTemplateHydratedRef.current) return;

    const activeTemplate = resolveActiveInvoiceTemplate(
      DEFAULT_ACTIVE_INVOICE_TEMPLATE,
    );
    const matchedTemplate =
      templateCatalog.find((template) =>
        matchesTemplateIdentity(
          template,
          activeTemplate.templateId,
          activeTemplate.templateName,
        ),
      ) ??
      featuredTemplates.find((template) =>
        matchesTemplateIdentity(
          template,
          activeTemplate.templateId,
          activeTemplate.templateName,
        ),
      ) ??
      templates.find((template) =>
        matchesTemplateIdentity(
          template,
          activeTemplate.templateId,
          activeTemplate.templateName,
        ),
      );

    if (!matchedTemplate) {
      activeTemplateHydratedRef.current = true;
      return;
    }

    setSelectedTemplateId(matchedTemplate.id);
    setThemeColor(activeTemplate.theme.primaryColor);
    setEnabledSections(activeTemplate.enabledSections);
    setSectionOrder(activeTemplate.sectionOrder);
    setDesignConfig(activeTemplate.designConfig);
    activeTemplateHydratedRef.current = true;
  }, [featuredTemplates, templateCatalog, templates]);

  useEffect(() => {
    const templateIdNumber = Number(selectedTemplateId);
    if (!templateIdNumber || Number.isNaN(templateIdNumber)) return;

    const userTemplate = userTemplateRecords.find(
      (item) => item.template_id === templateIdNumber,
    );
    const template = templatesFromApi?.find(
      (item) => item.id === selectedTemplateId,
    );

    if (userTemplate) {
      const normalizedEnabled = userTemplate.enabled_sections
        .map((section) => normalizeSection(section))
        .filter((section): section is SectionKey => Boolean(section));
      const normalizedOrder = userTemplate.section_order
        .map((section) => normalizeSection(section))
        .filter((section): section is SectionKey => Boolean(section));
      if (normalizedEnabled.length) setEnabledSections(normalizedEnabled);
      if (normalizedOrder.length) setSectionOrder(normalizedOrder);
      if (userTemplate.theme_color) {
        setThemeColor(userTemplate.theme_color);
      }
      if (userTemplate.design_config) {
        setDesignConfig(
          normalizeDesignConfig(
            userTemplate.design_config as Partial<DesignConfig>,
          ),
        );
      }
      return;
    }

    if (template) {
      setEnabledSections(template.defaultSections);
      if ("sectionOrder" in template && Array.isArray(template.sectionOrder)) {
        setSectionOrder(template.sectionOrder as SectionKey[]);
      } else {
        setSectionOrder(template.defaultSections);
      }
      setThemeColor(template.theme.primaryColor);
      setDesignConfig(createDesignConfig());
    }
  }, [
    selectedTemplateId,
    templatesFromApi,
    userTemplateRecords,
    normalizeSection,
  ]);

  const handleBusinessTypeChange = (value: string) => {
    setBusinessTypeId(value);
    const matched = BUSINESS_TYPES.find((type) => type.id === value);
    if (matched) {
      setEnabledSections(matched.defaultSections);
      setSectionOrder(matched.defaultSections);
      setPendingAutoSave(matched.defaultSections);
    }
  };

  useEffect(() => {
    if (!pendingAutoSave) return;

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      const templateIdNumber = Number(selectedTemplateId);
      if (!templateIdNumber || Number.isNaN(templateIdNumber)) return;

      saveTemplateMutation.mutate({
        template_id: templateIdNumber,
        enabled_sections: pendingAutoSave,
        section_order: pendingAutoSave,
        theme_color: themeColor,
        design_config: designConfig,
      });
      setPendingAutoSave(null);
    }, 600);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [
    pendingAutoSave,
    selectedTemplateId,
    themeColor,
    saveTemplateMutation,
    designConfig,
  ]);

  const handleToggleSection = (section: SectionKey) => {
    setEnabledSections((prev) => {
      if (prev.includes(section)) {
        return prev.filter((item) => item !== section);
      }
      return [...prev, section];
    });
  };

  const availableSections = useMemo(() => {
    return (selectedTemplate.sectionOrder ?? selectedTemplate.defaultSections).filter(
      (section) => !sectionOrder.includes(section),
    );
  }, [sectionOrder, selectedTemplate]);

  const previewAvailableSections = useMemo(() => {
    if (!previewTemplate) return [];
    return (previewTemplate.sectionOrder ?? previewTemplate.defaultSections).filter(
      (section) => !previewSectionOrder.includes(section),
    );
  }, [previewSectionOrder, previewTemplate]);

  const removeSection = (section: SectionKey) => {
    setEnabledSections((prev) => prev.filter((item) => item !== section));
    setSectionOrder((prev) => prev.filter((item) => item !== section));
  };

  const addSection = (section: SectionKey) => {
    setEnabledSections((prev) =>
      prev.includes(section) ? prev : [...prev, section],
    );
    setSectionOrder((prev) =>
      prev.includes(section) ? prev : [...prev, section],
    );
  };

  const removePreviewSection = (section: SectionKey) => {
    setPreviewEnabledSections((prev) => prev.filter((item) => item !== section));
    setPreviewSectionOrder((prev) => prev.filter((item) => item !== section));
  };

  const addPreviewSection = (section: SectionKey) => {
    setPreviewEnabledSections((prev) =>
      prev.includes(section) ? prev : [...prev, section],
    );
    setPreviewSectionOrder((prev) =>
      prev.includes(section) ? prev : [...prev, section],
    );
  };

  const reorderSections = (
    list: SectionKey[],
    source: SectionKey,
    target: SectionKey,
  ) => {
    const next = [...list];
    const fromIndex = next.indexOf(source);
    const toIndex = next.indexOf(target);
    if (fromIndex === -1 || toIndex === -1) return list;
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, source);
    return next;
  };

  const moveSection = (section: SectionKey, direction: "up" | "down") => {
    setSectionOrder((prev) => {
      const index = prev.indexOf(section);
      if (index === -1) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const updated = [...prev];
      const [removed] = updated.splice(index, 1);
      updated.splice(nextIndex, 0, removed);
      return updated;
    });
  };

  const movePreviewSection = (
    section: SectionKey,
    direction: "up" | "down",
  ) => {
    setPreviewSectionOrder((prev) => {
      const index = prev.indexOf(section);
      if (index === -1) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const updated = [...prev];
      const [removed] = updated.splice(index, 1);
      updated.splice(nextIndex, 0, removed);
      return updated;
    });
  };

  const handleDragStart = (section: SectionKey) => {
    setDraggedSection(section);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (section: SectionKey) => {
    if (!draggedSection || draggedSection === section) {
      setDraggedSection(null);
      return;
    }
    setSectionOrder((prev) => reorderSections(prev, draggedSection, section));
    setDraggedSection(null);
  };

  const handlePreviewDragStart = (section: SectionKey) => {
    setDraggedPreviewSection(section);
  };

  const handlePreviewDrop = (section: SectionKey) => {
    if (!draggedPreviewSection || draggedPreviewSection === section) {
      setDraggedPreviewSection(null);
      return;
    }
    setPreviewSectionOrder((prev) =>
      reorderSections(prev, draggedPreviewSection, section),
    );
    setDraggedPreviewSection(null);
  };

  const previewData = useMemo(() => {
    return {
      ...PREVIEW_INVOICE,
      business: {
        ...PREVIEW_INVOICE.business,
        businessName:
          businessProfile?.business_name ??
          PREVIEW_INVOICE.business.businessName,
        address: businessProfile?.address ?? PREVIEW_INVOICE.business.address,
        phone: businessProfile?.phone ?? PREVIEW_INVOICE.business.phone,
        email: businessProfile?.email ?? PREVIEW_INVOICE.business.email,
        website: businessProfile?.website ?? PREVIEW_INVOICE.business.website,
        logoUrl: businessProfile?.logo_url ?? PREVIEW_INVOICE.business.logoUrl,
        taxId: businessProfile?.tax_id ?? PREVIEW_INVOICE.business.taxId,
        currency:
          businessProfile?.currency ?? PREVIEW_INVOICE.business.currency,
        showTaxNumber:
          businessProfile?.show_tax_number ??
          PREVIEW_INVOICE.business.showTaxNumber,
        showLogoOnInvoice: showLogo,
      },
    };
  }, [businessProfile, showLogo]);

  const modalPreviewData = useMemo(() => {
    return {
      ...PREVIEW_INVOICE,
      business: {
        ...PREVIEW_INVOICE.business,
        businessName:
          businessProfile?.business_name ??
          PREVIEW_INVOICE.business.businessName,
        address: businessProfile?.address ?? PREVIEW_INVOICE.business.address,
        phone: businessProfile?.phone ?? PREVIEW_INVOICE.business.phone,
        email: businessProfile?.email ?? PREVIEW_INVOICE.business.email,
        website: businessProfile?.website ?? PREVIEW_INVOICE.business.website,
        logoUrl: businessProfile?.logo_url ?? PREVIEW_INVOICE.business.logoUrl,
        taxId: businessProfile?.tax_id ?? PREVIEW_INVOICE.business.taxId,
        currency:
          businessProfile?.currency ?? PREVIEW_INVOICE.business.currency,
        showTaxNumber:
          businessProfile?.show_tax_number ??
          PREVIEW_INVOICE.business.showTaxNumber,
        showLogoOnInvoice: previewShowLogo,
      },
    };
  }, [businessProfile, previewShowLogo]);

  const cardPreviewData = useMemo(() => {
    return {
      ...PREVIEW_INVOICE,
      business: {
        ...PREVIEW_INVOICE.business,
        businessName:
          businessProfile?.business_name ??
          PREVIEW_INVOICE.business.businessName,
        address: businessProfile?.address ?? PREVIEW_INVOICE.business.address,
        phone: businessProfile?.phone ?? PREVIEW_INVOICE.business.phone,
        email: businessProfile?.email ?? PREVIEW_INVOICE.business.email,
        website: businessProfile?.website ?? PREVIEW_INVOICE.business.website,
        logoUrl: businessProfile?.logo_url ?? PREVIEW_INVOICE.business.logoUrl,
        taxId: businessProfile?.tax_id ?? PREVIEW_INVOICE.business.taxId,
        currency:
          businessProfile?.currency ?? PREVIEW_INVOICE.business.currency,
        showTaxNumber:
          businessProfile?.show_tax_number ??
          PREVIEW_INVOICE.business.showTaxNumber,
        showLogoOnInvoice: Boolean(businessProfile?.logo_url),
      },
      items: PREVIEW_INVOICE.items.slice(0, 1),
      notes: "",
    };
  }, [businessProfile]);

  const theme = useMemo(() => {
    return {
      ...selectedTemplate.theme,
      primaryColor: themeColor || selectedTemplate.theme.primaryColor,
    };
  }, [selectedTemplate, themeColor]);

  const previewTheme = useMemo(() => {
    if (!previewTemplate) return theme;
    return {
      ...previewTemplate.theme,
      primaryColor: previewThemeColor || previewTemplate.theme.primaryColor,
    };
  }, [previewTemplate, previewThemeColor, theme]);

  const updateDesignSection = useCallback(
    (section: SectionKey, updates: Partial<SectionStyleConfig>) => {
      setDesignConfig((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          ...updates,
        },
      }));
    },
    [],
  );

  const resetDesignSection = useCallback((section: SectionKey) => {
    setDesignConfig((prev) => ({
      ...prev,
      [section]: getDefaultSectionConfig(section),
    }));
  }, []);

  const resetAllDesign = useCallback(() => {
    setDesignConfig(createDesignConfig());
  }, []);

  const handleSaveDesignConfig = useCallback(async () => {
    const templateIdNumber = Number(selectedTemplateId);
    if (!templateIdNumber || Number.isNaN(templateIdNumber)) return;

    await saveTemplateMutation.mutateAsync({
      template_id: templateIdNumber,
      enabled_sections: enabledSections,
      section_order: sectionOrder,
      theme_color: themeColor,
      design_config: designConfig,
    });
  }, [
    designConfig,
    enabledSections,
    saveTemplateMutation,
    sectionOrder,
    selectedTemplateId,
    themeColor,
  ]);

  const handleLoadDesignConfig = useCallback(async () => {
    const selectedId = Number(selectedTemplateId);
    if (!selectedId || Number.isNaN(selectedId)) {
      toast.error("Select a saved template first");
      return;
    }

    try {
      const latestRecords = await fetchUserTemplates();
      queryClient.setQueryData(["user-templates"], latestRecords);

      const record = latestRecords.find(
        (item) => item.template_id === selectedId,
      );
      if (!record?.design_config) {
        toast.error("No saved design found");
        return;
      }

      setDesignConfig(
        normalizeDesignConfig(record.design_config as Partial<DesignConfig>),
      );
      toast.success("Design settings loaded");
    } catch {
      toast.error("Unable to load design settings");
    }
  }, [queryClient, selectedTemplateId]);

  const handleBackgroundUpload = useCallback(
    (section: SectionKey, event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          updateDesignSection(section, { backgroundImage: reader.result });
        }
      };
      reader.readAsDataURL(file);
    },
    [updateDesignSection],
  );

  const designContextValue = useMemo(
    () => ({
      designConfig,
      updateSection: updateDesignSection,
      resetSection: resetDesignSection,
      resetAll: resetAllDesign,
    }),
    [designConfig, resetAllDesign, resetDesignSection, updateDesignSection],
  );

  const applyTemplate = (
    templateId: string,
    overrides?: {
      color?: string;
      enabledSections?: SectionKey[];
      sectionOrder?: SectionKey[];
      designConfig?: DesignConfig;
    },
  ) => {
    const template =
      templateCatalog.find((item) => item.id === templateId) ??
      templates.find((item) => item.id === templateId);
    if (!template) return;
    const templateIdNumber = Number(templateId);
    const savedTemplateSettings = userTemplateRecords.find(
      (item) => item.template_id === templateIdNumber,
    );
    const nextEnabledSections =
      overrides?.enabledSections ??
      savedTemplateSettings?.enabled_sections
        ?.map((section) => normalizeSection(section))
        .filter((section): section is SectionKey => Boolean(section)) ??
      template.defaultSections;
    const nextSectionOrder =
      overrides?.sectionOrder ??
      savedTemplateSettings?.section_order
        ?.map((section) => normalizeSection(section))
        .filter((section): section is SectionKey => Boolean(section)) ??
      template.sectionOrder ??
      template.defaultSections;
    const nextThemeColor =
      overrides?.color ??
      savedTemplateSettings?.theme_color ??
      template.theme.primaryColor;
    const nextDesignConfig =
      overrides?.designConfig ??
      normalizeDesignConfig(
        (savedTemplateSettings?.design_config as Partial<DesignConfig>) ?? null,
      );

    setSelectedTemplateId(templateId);
    setThemeColor(nextThemeColor);
    setEnabledSections(nextEnabledSections);
    setSectionOrder(nextSectionOrder);
    setDesignConfig(nextDesignConfig);
    saveActiveInvoiceTemplate({
      templateId: template.id,
      templateName: template.name,
      enabledSections: nextEnabledSections,
      sectionOrder: nextSectionOrder,
      theme: {
        ...template.theme,
        primaryColor: nextThemeColor,
      },
      designConfig: nextDesignConfig,
    });
  };

  const openPreview = (templateId: string) => {
    const template =
      templateCatalog.find((item) => item.id === templateId) ??
      templates.find((item) => item.id === templateId);
    if (!template) return;
    setPreviewTemplateId(templateId);
    setPreviewThemeColor(template.theme.primaryColor);
    setPreviewEnabledSections(template.defaultSections);
    setPreviewSectionOrder(template.sectionOrder ?? template.defaultSections);
    setPreviewShowLogo(Boolean(businessProfile?.logo_url));
  };

  const closePreview = useCallback(() => {
    setPreviewTemplateId(null);
  }, []);

  useEffect(() => {
    if (!previewTemplate) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [closePreview, previewTemplate]);

  const handleSaveSettings = async () => {
    const templateIdNumber = Number(selectedTemplateId);
    if (!templateIdNumber || Number.isNaN(templateIdNumber)) return;

    await saveTemplateMutation.mutateAsync({
      template_id: templateIdNumber,
      enabled_sections: enabledSections,
      section_order: sectionOrder,
      theme_color: themeColor,
      design_config: designConfig,
    });
  };

  const buildSavedTemplatePayload = useCallback(() => {
    const selectedId = Number(selectedTemplateId);
    return {
      base_template_id: Number.isNaN(selectedId) ? undefined : selectedId,
      enabled_sections: enabledSections,
      section_order: sectionOrder,
      theme_color: themeColor,
      design_config: designConfig,
    };
  }, [
    designConfig,
    enabledSections,
    sectionOrder,
    selectedTemplateId,
    themeColor,
  ]);

  const handleCreateSavedTemplate = async () => {
    const defaultName = `${selectedTemplate.name} ${t("templatesPage.copySuffix")}`;
    const name = window.prompt(
      t("templatesPage.prompts.saveName"),
      defaultName,
    );
    if (!name?.trim()) return;

    await createSavedTemplateMutation.mutateAsync({
      name: name.trim(),
      ...buildSavedTemplatePayload(),
    });
  };

  const applySavedTemplate = (
    savedTemplate: (typeof userSavedTemplates)[number],
  ) => {
    if (savedTemplate.base_template_id) {
      const found = templates.find(
        (template) => Number(template.id) === savedTemplate.base_template_id,
      );
      if (found) {
        setSelectedTemplateId(found.id);
      }
    }

    const normalizedEnabled = savedTemplate.enabled_sections
      .map((section) => normalizeSection(section))
      .filter((section): section is SectionKey => Boolean(section));
    const normalizedOrder = savedTemplate.section_order
      .map((section) => normalizeSection(section))
      .filter((section): section is SectionKey => Boolean(section));

    if (normalizedEnabled.length) setEnabledSections(normalizedEnabled);
    if (normalizedOrder.length) setSectionOrder(normalizedOrder);
    if (savedTemplate.theme_color) setThemeColor(savedTemplate.theme_color);
    if (savedTemplate.design_config) {
      setDesignConfig(
        normalizeDesignConfig(
          savedTemplate.design_config as Partial<DesignConfig>,
        ),
      );
    }
  };

  const handleRenameSavedTemplate = async (
    savedTemplate: (typeof userSavedTemplates)[number],
  ) => {
    const nextName = window.prompt(
      t("templatesPage.prompts.renameName"),
      savedTemplate.name,
    );
    if (!nextName?.trim()) return;

    await updateSavedTemplateMutation.mutateAsync({
      id: savedTemplate.id,
      payload: { name: nextName.trim() },
    });
  };

  const handleUpdateSavedTemplate = async (id: number) => {
    await updateSavedTemplateMutation.mutateAsync({
      id,
      payload: buildSavedTemplatePayload(),
    });
  };

  const handleDeleteSavedTemplate = async (id: number) => {
    const confirmed = window.confirm(t("templatesPage.prompts.deleteConfirm"));
    if (!confirmed) return;
    await deleteSavedTemplateMutation.mutateAsync(id);
  };

  const activeDesignConfig =
    designConfig[activeDesignSection] ??
    getDefaultSectionConfig(activeDesignSection);

  useEffect(() => {
    setThemeHexInput(themeColor);
  }, [themeColor]);

  useEffect(() => {
    setBackgroundHexInput(activeDesignConfig.backgroundColor);
    setTextHexInput(activeDesignConfig.textColor);
  }, [activeDesignConfig.backgroundColor, activeDesignConfig.textColor]);

  const applyThemeHexInput = () => {
    const normalized = normalizeHexColor(themeHexInput);
    if (!normalized) {
      toast.error(t("templatesPage.toasts.validThemeHex"));
      return;
    }
    setThemeColor(normalized);
  };

  const applySectionHexInput = (
    key: "backgroundColor" | "textColor",
    value: string,
  ) => {
    const normalized = normalizeHexColor(value);
    if (!normalized) {
      toast.error(t("templatesPage.toasts.validSectionHex"));
      return;
    }
    updateDesignSection(activeDesignSection, { [key]: normalized });
  };

  const filteredUserSavedTemplates = useMemo(() => {
    const searchValue = savedTemplateSearch.trim().toLowerCase();
    const selectedId = Number(selectedTemplateId);

    return userSavedTemplates.filter((savedTemplate) => {
      const matchesSearch = searchValue
        ? savedTemplate.name.toLowerCase().includes(searchValue)
        : true;
      const matchesFilter =
        savedTemplateFilter === "all"
          ? true
          : savedTemplate.base_template_id === selectedId;

      return matchesSearch && matchesFilter;
    });
  }, [
    savedTemplateFilter,
    savedTemplateSearch,
    selectedTemplateId,
    userSavedTemplates,
  ]);

  const livePreviewStackKey = `templates-live-${selectedTemplate.id}-${enabledSections.join(",")}-${sectionOrder.join(",")}-${theme.primaryColor}`;
  const modalPreviewStackKey = previewTemplate
    ? `templates-modal-${previewTemplate.id}-${previewEnabledSections.join(",")}-${previewSectionOrder.join(",")}-${previewThemeColor}-${previewShowLogo}`
    : "";

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("templatesPage.title")}
      subtitle={t("templatesPage.subtitle")}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div
          className={`grid gap-8 ${
            openLivePreview
              ? "lg:grid-cols-[1.2fr_0.8fr]"
              : "lg:grid-cols-[1fr_auto]"
          }`}
        >
          <section className="space-y-6">
            <header>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                {t("templatesPage.kicker")}
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{t("templatesPage.heading")}</h1>
              <p className="mt-2 text-sm text-[#5c4b3b]">
                {t("templatesPage.description")}
              </p>
            </header>

            <div className="rounded-3xl border border-border bg-white p-6">
              <button
                type="button"
                onClick={() => setOpenBusinessType((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={openBusinessType}
              >
                <h2 className="text-sm font-semibold">{t("templatesPage.sections.businessType")}</h2>
                <ChevronDown
                  className={`h-4 w-4 text-[#8a6d56] transition ${
                    openBusinessType ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>
              {openBusinessType ? (
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
              ) : null}
            </div>

            <div className="rounded-3xl border border-border bg-white p-6">
              <button
                type="button"
                onClick={() => setOpenCustomize((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={openCustomize}
              >
                <h2 className="text-sm font-semibold">{t("templatesPage.sections.customize")}</h2>
                <ChevronDown
                  className={`h-4 w-4 text-[#8a6d56] transition ${
                    openCustomize ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>
              {openCustomize ? (
                <>
                  <div className="mt-4 grid gap-3">
                    {sectionOrder.map((section) => (
                      <div
                        key={section}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(section)}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                          draggedSection === section
                            ? "border-primary/60 bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <label className="flex items-center gap-3 text-sm">
                          <button
                            type="button"
                            draggable
                            onDragStart={() => handleDragStart(section)}
                            className="rounded-full border border-border bg-white p-1 text-[#8a6d56] hover:text-primary"
                            aria-label={t("templatesPage.aria.dragToReorder")}
                          >
                            <GripVertical size={14} />
                          </button>
                          <input
                            type="checkbox"
                            checked={enabledSections.includes(section)}
                            onChange={() => handleToggleSection(section)}
                            className="h-4 w-4 rounded border-[#d6c8b8] text-primary"
                          />
                          {SECTION_LABELS[section]}
                        </label>
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => removeSection(section)}
                            className="rounded-full border border-border px-3 py-1"
                          >
                            {t("templatesPage.actions.remove")}
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSection(section, "up")}
                            className="rounded-full border border-border px-3 py-1"
                          >
                            {t("templatesPage.actions.moveUp")}
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSection(section, "down")}
                            className="rounded-full border border-border px-3 py-1"
                          >
                            {t("templatesPage.actions.moveDown")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {availableSections.length ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d56]">
                        {t("templatesPage.actions.addSections")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {availableSections.map((section) => (
                          <button
                            key={`add-${section}`}
                            type="button"
                            onClick={() => addSection(section)}
                            className="rounded-full border border-border px-3 py-1 text-xs"
                          >
                            + {SECTION_LABELS[section]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
                    <div className="grid gap-2">
                      <label className="flex items-center gap-2">
                        <span>{t("templatesPage.actions.themeColor")}</span>
                        <input
                          type="color"
                          value={themeColor}
                          onChange={(event) =>
                            setThemeColor(event.target.value)
                          }
                          className="h-9 w-9 rounded border border-border"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {COLOR_PRESETS.map((color) => (
                          <button
                            key={`theme-${color}`}
                            type="button"
                            aria-label={t("templatesPage.aria.setThemeColor", { color })}
                            onClick={() => setThemeColor(color)}
                            className="h-6 w-6 rounded-full border border-[#d6c8b8]"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={themeHexInput}
                          onChange={(event) =>
                            setThemeHexInput(event.target.value)
                          }
                          placeholder="#2563eb"
                          className="w-28 rounded-lg border border-border px-2 py-1 text-xs uppercase"
                        />
                        <button
                          type="button"
                          onClick={applyThemeHexInput}
                          className="rounded-full border border-border px-3 py-1 text-xs"
                        >
                          {t("templatesPage.actions.apply")}
                        </button>
                      </div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={() => setShowLogo((prev) => !prev)}
                        className="h-4 w-4 rounded border-[#d6c8b8] text-primary"
                      />
                      {t("templatesPage.actions.showLogo")}
                    </label>
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={saveTemplateMutation.isPending}
                      className="ml-auto rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {saveTemplateMutation.isPending
                        ? t("templatesPage.actions.saving")
                        : t("templatesPage.actions.saveSettings")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-3xl border border-border bg-white p-6">
              <button
                type="button"
                onClick={() => setOpenDesignPanel((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={openDesignPanel}
              >
                <h2 className="text-sm font-semibold">{t("templatesPage.sections.styling")}</h2>
                <ChevronDown
                  className={`h-4 w-4 text-[#8a6d56] transition ${
                    openDesignPanel ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>
              {openDesignPanel ? (
                <>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {sectionOrder.map((section) => (
                      <button
                        key={`design-${section}`}
                        type="button"
                        onClick={() => setActiveDesignSection(section)}
                        className={`rounded-2xl border px-3 py-2 text-left text-xs transition ${
                          activeDesignSection === section
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-[#5c4b3b] hover:border-primary/50"
                        }`}
                      >
                        {SECTION_LABELS[section]}
                      </button>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-4 text-sm">
                    <div className="grid gap-2">
                      <label className="flex items-center justify-between gap-4">
                        <span>{t("templatesPage.actions.backgroundColor")}</span>
                        <input
                          type="color"
                          value={activeDesignConfig.backgroundColor}
                          onChange={(event) =>
                            updateDesignSection(activeDesignSection, {
                              backgroundColor: event.target.value,
                            })
                          }
                          className="h-9 w-9 rounded border border-border"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {COLOR_PRESETS.map((color) => (
                          <button
                            key={`bg-${color}`}
                            type="button"
                            aria-label={t("templatesPage.aria.setBackgroundColor", { color })}
                            onClick={() =>
                              updateDesignSection(activeDesignSection, {
                                backgroundColor: color,
                              })
                            }
                            className="h-6 w-6 rounded-full border border-[#d6c8b8]"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={backgroundHexInput}
                          onChange={(event) =>
                            setBackgroundHexInput(event.target.value)
                          }
                          placeholder="#ffffff"
                          className="w-28 rounded-lg border border-border px-2 py-1 text-xs uppercase"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            applySectionHexInput(
                              "backgroundColor",
                              backgroundHexInput,
                            )
                          }
                          className="rounded-full border border-border px-3 py-1 text-xs"
                        >
                          {t("templatesPage.actions.apply")}
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <label className="flex items-center justify-between gap-4">
                        <span>{t("templatesPage.actions.textColor")}</span>
                        <input
                          type="color"
                          value={activeDesignConfig.textColor}
                          onChange={(event) =>
                            updateDesignSection(activeDesignSection, {
                              textColor: event.target.value,
                            })
                          }
                          className="h-9 w-9 rounded border border-border"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {COLOR_PRESETS.map((color) => (
                          <button
                            key={`text-${color}`}
                            type="button"
                            aria-label={t("templatesPage.aria.setTextColor", { color })}
                            onClick={() =>
                              updateDesignSection(activeDesignSection, {
                                textColor: color,
                              })
                            }
                            className="h-6 w-6 rounded-full border border-[#d6c8b8]"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={textHexInput}
                          onChange={(event) =>
                            setTextHexInput(event.target.value)
                          }
                          placeholder="#334155"
                          className="w-28 rounded-lg border border-border px-2 py-1 text-xs uppercase"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            applySectionHexInput("textColor", textHexInput)
                          }
                          className="rounded-full border border-border px-3 py-1 text-xs"
                        >
                          {t("templatesPage.actions.apply")}
                        </button>
                      </div>
                    </div>
                    <label className="grid gap-2">
                      <span>{t("templatesPage.actions.fontFamily")}</span>
                      <select
                        value={activeDesignConfig.fontFamily}
                        onChange={(event) =>
                          updateDesignSection(activeDesignSection, {
                            fontFamily: event.target.value,
                          })
                        }
                        className="rounded-xl border border-border px-3 py-2 text-sm"
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option key={font.value} value={font.value}>
                            {font.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span>{t("templatesPage.actions.fontSize", { value: activeDesignConfig.fontSize })}</span>
                      <input
                        type="range"
                        min={10}
                        max={28}
                        value={activeDesignConfig.fontSize}
                        onChange={(event) =>
                          updateDesignSection(activeDesignSection, {
                            fontSize: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-2">
                      <span>
                        {t("templatesPage.actions.sectionPadding", { value: activeDesignConfig.padding })}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={48}
                        value={activeDesignConfig.padding}
                        onChange={(event) =>
                          updateDesignSection(activeDesignSection, {
                            padding: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-2">
                      <span>
                        {t("templatesPage.actions.sectionMargin", { value: activeDesignConfig.margin })}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={32}
                        value={activeDesignConfig.margin}
                        onChange={(event) =>
                          updateDesignSection(activeDesignSection, {
                            margin: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-2">
                      <span>
                        {t("templatesPage.actions.borderRadius", { value: activeDesignConfig.borderRadius })}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={32}
                        value={activeDesignConfig.borderRadius}
                        onChange={(event) =>
                          updateDesignSection(activeDesignSection, {
                            borderRadius: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-2">
                      <span>{t("templatesPage.actions.sectionWidth")}</span>
                      <select
                        value={activeDesignConfig.width}
                        onChange={(event) =>
                          updateDesignSection(activeDesignSection, {
                            width: event.target.value as "contained" | "full",
                          })
                        }
                        className="rounded-xl border border-border px-3 py-2 text-sm"
                      >
                        <option value="contained">{t("templatesPage.actions.widthContained")}</option>
                        <option value="full">{t("templatesPage.actions.widthFull")}</option>
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span>{t("templatesPage.actions.backgroundImage")}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          handleBackgroundUpload(activeDesignSection, event)
                        }
                        className="text-xs"
                      />
                    </label>
                    {activeDesignConfig.backgroundImage ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateDesignSection(activeDesignSection, {
                            backgroundImage: "",
                          })
                        }
                        className="rounded-full border border-border px-3 py-2 text-xs"
                      >
                        {t("templatesPage.actions.removeBackgroundImage")}
                      </button>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <button
                        type="button"
                        onClick={handleCreateSavedTemplate}
                        disabled={createSavedTemplateMutation.isPending}
                        className="rounded-full border border-border px-3 py-2"
                      >
                      {createSavedTemplateMutation.isPending
                          ? t("templatesPage.actions.savingTemplate")
                          : t("templatesPage.actions.saveAsTemplate")}
                      </button>
                      <button
                        type="button"
                        onClick={() => resetDesignSection(activeDesignSection)}
                        className="rounded-full border border-border px-3 py-2"
                      >
                        {t("templatesPage.actions.resetSection")}
                      </button>
                      <button
                        type="button"
                        onClick={resetAllDesign}
                        className="rounded-full border border-border px-3 py-2"
                      >
                        {t("templatesPage.actions.resetAll")}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDesignConfig}
                        className="ml-auto rounded-full bg-primary px-3 py-2 font-semibold text-primary-foreground"
                      >
                        {t("templatesPage.actions.saveDesign")}
                      </button>
                      <button
                        type="button"
                        onClick={handleLoadDesignConfig}
                        className="rounded-full border border-border px-3 py-2"
                      >
                        {t("templatesPage.actions.loadDesign")}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <section
            className={`flex h-full flex-col rounded-3xl border border-border bg-white ${
              openLivePreview ? "p-6" : "p-3"
            }`}
            style={openLivePreview ? undefined : { width: "64px" }}
          >
            <div
              className={`flex items-center justify-between ${
                openLivePreview ? "" : "flex-col gap-2"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenLivePreview((prev) => !prev)}
                className={`flex items-center gap-2 text-left ${
                  openLivePreview ? "" : "flex-col"
                }`}
                aria-expanded={openLivePreview}
              >
                {openLivePreview ? (
                  <h2 className="text-sm font-semibold">{t("templatesPage.sections.livePreview")}</h2>
                ) : (
                  <span className="text-xs font-semibold text-[#5c4b3b]">
                    {t("templatesPage.live")}
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-[#8a6d56] transition ${
                    openLivePreview ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>
              {openLivePreview ? (
                <span className="text-xs text-[#8a6d56]">{t("templatesPage.mockData")}</span>
              ) : null}
            </div>
            {openLivePreview ? (
              <div className="mt-5 flex-1 overflow-auto rounded-3xl border border-border bg-white p-3">
                <div className="mx-auto w-full max-w-[520px]">
                  <DesignConfigProvider value={designContextValue}>
                    <A4PreviewStack
                      key={livePreviewStackKey}
                      className="w-full"
                      stackKey={livePreviewStackKey}
                    >
                      <MemoTemplatePreview
                        key={`live-${selectedTemplate.id}-${enabledSections.join(",")}-${sectionOrder.join(",")}`}
                        templateId={selectedTemplate.id}
                        templateName={selectedTemplate.name}
                        data={previewData}
                        enabledSections={enabledSections}
                        sectionOrder={sectionOrder}
                        theme={theme}
                      />
                    </A4PreviewStack>
                  </DesignConfigProvider>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <section className="mt-8 rounded-3xl border border-border bg-white p-6">
          <button
            type="button"
            onClick={() => setOpenTemplateSelection((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={openTemplateSelection}
          >
            <h2 className="text-sm font-semibold">{t("templatesPage.sections.selection")}</h2>
            <ChevronDown
              className={`h-4 w-4 text-[#8a6d56] transition ${
                openTemplateSelection ? "rotate-0" : "-rotate-90"
              }`}
            />
          </button>
          {openTemplateSelection ? (
            <>
              {templatesLoading ? (
                <p className="mt-3 text-xs text-[#8a6d56]">
                  {t("templatesPage.loading")}
                </p>
              ) : null}
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d56]">
                    {t("templatesPage.savedTemplates")}
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateSavedTemplate}
                    disabled={createSavedTemplateMutation.isPending}
                    className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold"
                  >
                    {createSavedTemplateMutation.isPending
                      ? t("templatesPage.actions.saving")
                      : t("templatesPage.actions.saveCurrent")}
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    value={savedTemplateSearch}
                    onChange={(event) =>
                      setSavedTemplateSearch(event.target.value)
                    }
                    placeholder={t("templatesPage.searchPlaceholder")}
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <select
                    value={savedTemplateFilter}
                    onChange={(event) =>
                      setSavedTemplateFilter(
                        event.target.value as "all" | "current-template",
                      )
                    }
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <option value="all">{t("templatesPage.filters.allTemplates")}</option>
                    <option value="current-template">{t("templatesPage.filters.currentBase")}</option>
                  </select>
                </div>
                {filteredUserSavedTemplates.length ? (
                  <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredUserSavedTemplates.map((savedTemplate) => (
                      <div
                        key={`saved-${savedTemplate.id}`}
                        className="rounded-2xl border border-border bg-muted/40 px-4 py-4"
                      >
                        <p className="text-sm font-semibold">
                          {savedTemplate.name}
                        </p>
                        <p className="mt-1 text-xs text-[#6b5847]">
                          {t("templatesPage.updated", {
                            value: formatDate(new Date(savedTemplate.updated_at), {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }),
                          })}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => applySavedTemplate(savedTemplate)}
                            className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground"
                          >
                            {t("templatesPage.actions.applyTemplate")}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSavedTemplate(savedTemplate.id)
                            }
                            disabled={updateSavedTemplateMutation.isPending}
                            className="rounded-full border border-border px-3 py-1 text-[11px]"
                          >
                            {t("templatesPage.actions.update")}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleRenameSavedTemplate(savedTemplate)
                            }
                            disabled={updateSavedTemplateMutation.isPending}
                            className="rounded-full border border-border px-3 py-1 text-[11px]"
                          >
                            {t("templatesPage.actions.rename")}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteSavedTemplate(savedTemplate.id)
                            }
                            disabled={deleteSavedTemplateMutation.isPending}
                            className="rounded-full border border-red-200 px-3 py-1 text-[11px] text-red-600"
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#8a6d56]">
                    {userSavedTemplates.length
                      ? t("templatesPage.empty.filtered")
                      : t("templatesPage.empty.none")}
                  </p>
                )}
              </div>
              {featuredTemplates.length ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d56]">
                    {t("templatesPage.featured")}
                  </p>
                  <div className="mt-3 grid justify-items-center gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {featuredTemplates.map((template) => (
                      <div
                        key={`featured-${template.id}`}
                        className={`w-full max-w-[430px] rounded-2xl border px-4 py-4 text-left transition ${
                          selectedTemplateId === template.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div
                              className="h-2 w-12 rounded-full"
                              style={{
                                backgroundColor: template.theme.primaryColor,
                              }}
                            />
                            <p className="mt-3 text-base font-semibold">
                              {template.name}
                            </p>
                            {template.bestFor ? (
                              <p className="mt-2 inline-flex rounded-full bg-[#f6efe8] px-2.5 py-1 text-[11px] font-medium text-[#8a6d56]">
                                {template.bestFor}
                              </p>
                            ) : null}
                            <p className="mt-3 text-xs text-[#5c4b3b]">
                              {template.description}
                            </p>
                          </div>
                          {selectedTemplateId === template.id ? (
                            <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                              {t("templatesPage.active")}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 h-60 overflow-hidden rounded-xl border border-border bg-white p-2">
                          <div
                            className="pointer-events-none origin-top-left"
                            style={{
                              width: A4_WIDTH_PX,
                              height: A4_HEIGHT_PX,
                              transform: "scale(0.26)",
                            }}
                          >
                            <div className="h-full w-full bg-white p-4">
                              <MemoTemplatePreview
                                key={`featured-${template.id}`}
                                templateId={template.id}
                                templateName={template.name}
                                data={cardPreviewData}
                                enabledSections={template.defaultSections}
                                sectionOrder={template.sectionOrder}
                                theme={template.theme}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => openPreview(template.id)}
                            className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                          >
                            {t("templatesPage.actions.preview")}
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTemplate(template.id)}
                            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                          >
                            {t("templatesPage.actions.useTemplate")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
      {previewTemplate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePreview();
            }
          }}
        >
          <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white text-[#1f1b16] shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  {t("templatesPage.previewTitle")}
                </p>
                <h3 className="mt-1 text-xl font-semibold">
                  {previewTemplate.name}
                </h3>
                {previewTemplate.bestFor ? (
                  <p className="mt-2 text-sm text-[#8a6d56]">
                    {previewTemplate.bestFor}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await downloadPdf({
                        previewPayload: {
                          templateId: previewTemplate.id,
                          templateName: previewTemplate.name,
                          data: modalPreviewData,
                          enabledSections: previewEnabledSections,
                          sectionOrder: previewSectionOrder,
                          theme: previewTheme,
                          designConfig,
                        },
                        fileName: `${previewTemplate.name}-preview.pdf`,
                      });
                    } catch {
                      toast.error(t("templatesPage.toasts.previewPdfError"));
                    }
                  }}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                >
                  {t("templatesPage.actions.downloadPdf")}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const normalizedOrder = previewSectionOrder.length
                      ? previewSectionOrder
                      : previewEnabledSections;
                    applyTemplate(previewTemplate.id, {
                      color: previewThemeColor,
                      enabledSections: previewEnabledSections,
                      sectionOrder: normalizedOrder,
                      designConfig,
                    });

                    const templateIdNumber = Number(previewTemplate.id);
                    if (templateIdNumber && !Number.isNaN(templateIdNumber)) {
                      await saveTemplateMutation.mutateAsync({
                        template_id: templateIdNumber,
                        enabled_sections: previewEnabledSections,
                        section_order: normalizedOrder,
                        theme_color: previewThemeColor,
                        design_config: designConfig,
                      });
                    }

                    closePreview();
                  }}
                  disabled={saveTemplateMutation.isPending}
                  className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saveTemplateMutation.isPending
                    ? t("templatesPage.actions.saving")
                    : t("templatesPage.actions.useTemplate")}
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                >
                  {t("templatesPage.actions.close")}
                </button>
              </div>
            </div>
            <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[0.4fr_0.6fr]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <h4 className="text-sm font-semibold">{t("templatesPage.previewSettings")}</h4>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <span>{t("templatesPage.actions.themeColor")}</span>
                      <input
                        type="color"
                        value={previewThemeColor}
                        onChange={(event) =>
                          setPreviewThemeColor(event.target.value)
                        }
                        className="h-9 w-9 rounded border border-border"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={previewShowLogo}
                        onChange={() => setPreviewShowLogo((prev) => !prev)}
                        className="h-4 w-4 rounded border-[#d6c8b8] text-primary"
                      />
                      {t("templatesPage.actions.showLogo")}
                    </label>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-white p-4">
                  <h4 className="text-sm font-semibold">{t("templatesPage.previewSections")}</h4>
                  <div className="mt-3 grid gap-2 text-sm">
                    {previewSectionOrder.map((section) => (
                      <div
                        key={section}
                        onDragOver={handleDragOver}
                        onDrop={() => handlePreviewDrop(section)}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2 transition ${
                          draggedPreviewSection === section
                            ? "border-primary/60 bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <label className="flex items-center gap-3">
                          <button
                            type="button"
                            draggable
                            onDragStart={() => handlePreviewDragStart(section)}
                            className="rounded-full border border-border bg-white p-1 text-[#8a6d56] hover:text-primary"
                            aria-label={t("templatesPage.aria.dragToReorder")}
                          >
                            <GripVertical size={14} />
                          </button>
                          <input
                            type="checkbox"
                            checked={previewEnabledSections.includes(section)}
                            onChange={() =>
                              setPreviewEnabledSections((prev) => {
                                if (prev.includes(section)) {
                                  return prev.filter(
                                    (item) => item !== section,
                                  );
                                }
                                return [...prev, section];
                              })
                            }
                            className="h-4 w-4 rounded border-[#d6c8b8] text-primary"
                          />
                          <span>{SECTION_LABELS[section]}</span>
                        </label>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => removePreviewSection(section)}
                            className="rounded-full border border-border px-2 py-1"
                          >
                            {t("templatesPage.actions.remove")}
                          </button>
                          <button
                            type="button"
                            onClick={() => movePreviewSection(section, "up")}
                            className="rounded-full border border-border px-2 py-1"
                          >
                            {t("templatesPage.actions.up")}
                          </button>
                          <button
                            type="button"
                            onClick={() => movePreviewSection(section, "down")}
                            className="rounded-full border border-border px-2 py-1"
                          >
                            {t("templatesPage.actions.down")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {previewAvailableSections.length ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d56]">
                        {t("templatesPage.actions.addSections")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {previewAvailableSections.map((section) => (
                          <button
                            key={`preview-add-${section}`}
                            type="button"
                            onClick={() => addPreviewSection(section)}
                            className="rounded-full border border-border px-3 py-1 text-[11px]"
                          >
                            + {SECTION_LABELS[section]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-white p-4">
                <div className="rounded-2xl border border-border bg-white p-2.5">
                  <div
                    id="template-preview-pdf-root"
                    className="mx-auto w-full max-w-[820px]"
                  >
                    <DesignConfigProvider value={designContextValue}>
                      <A4PreviewStack
                        key={modalPreviewStackKey}
                        stackKey={modalPreviewStackKey}
                      >
                        <MemoTemplatePreview
                          key={`modal-${previewTemplate.id}-${previewEnabledSections.join(",")}-${previewSectionOrder.join(",")}-${previewThemeColor}-${previewShowLogo}`}
                          templateId={previewTemplate.id}
                          templateName={previewTemplate.name}
                          data={modalPreviewData}
                          enabledSections={previewEnabledSections}
                          sectionOrder={previewSectionOrder}
                          theme={previewTheme}
                        />
                      </A4PreviewStack>
                    </DesignConfigProvider>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
};

export default TemplatesClient;
