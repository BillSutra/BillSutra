import type {
  BusinessTypeConfig,
  InvoiceTemplateConfig,
  InvoiceTemplateVariant,
  SectionKey,
} from "@/types/invoice-template";

export const SECTION_LABELS: Record<SectionKey, string> = {
  header: "Header",
  company_details: "Company details",
  client_details: "Client details",
  items: "Items",
  service_items: "Service items",
  tax: "Tax",
  discount: "Discount",
  payment_info: "Payment info",
  notes: "Notes",
  footer: "Footer",
};

export const BUSINESS_TYPES: BusinessTypeConfig[] = [
  {
    id: "retail",
    label: "Retail Shop",
    defaultSections: [
      "header",
      "company_details",
      "client_details",
      "items",
      "tax",
      "discount",
      "payment_info",
      "notes",
      "footer",
    ],
  },
  {
    id: "freelancer",
    label: "Freelancer / Service",
    defaultSections: [
      "header",
      "company_details",
      "client_details",
      "items",
      "tax",
      "payment_info",
      "notes",
      "footer",
    ],
  },
  {
    id: "agency",
    label: "Agency",
    defaultSections: [
      "header",
      "company_details",
      "client_details",
      "items",
      "tax",
      "discount",
      "payment_info",
      "notes",
      "footer",
    ],
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    defaultSections: [
      "header",
      "company_details",
      "client_details",
      "items",
      "tax",
      "discount",
      "payment_info",
      "notes",
      "footer",
    ],
  },
  {
    id: "gst",
    label: "GST Registered Business",
    defaultSections: [
      "header",
      "company_details",
      "client_details",
      "items",
      "tax",
      "discount",
      "payment_info",
      "notes",
      "footer",
    ],
  },
  {
    id: "other",
    label: "Other",
    defaultSections: [
      "header",
      "company_details",
      "client_details",
      "items",
      "tax",
      "payment_info",
      "notes",
      "footer",
    ],
  },
];

type TemplatePreset = {
  id: string;
  variant: InvoiceTemplateVariant;
  name: string;
  description: string;
  bestFor: string;
  layout: InvoiceTemplateConfig["layout"];
  defaultSections: SectionKey[];
  sectionOrder?: SectionKey[];
  theme: InvoiceTemplateConfig["theme"];
  preferredSourceNames: string[];
  aliases: string[];
};

const FULL_INVOICE_SECTIONS: SectionKey[] = [
  "header",
  "company_details",
  "client_details",
  "items",
  "tax",
  "discount",
  "payment_info",
  "notes",
  "footer",
];

export const CURATED_TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "professional",
    variant: "classic",
    name: "Classic Business Invoice",
    description:
      "Traditional borders and a structured layout for formal business billing.",
    bestFor: "Best for established businesses and formal client invoices.",
    layout: "stacked",
    defaultSections: FULL_INVOICE_SECTIONS,
    theme: {
      primaryColor: "#1f2937",
      fontFamily: "var(--font-geist-mono)",
      tableStyle: "grid",
    },
    preferredSourceNames: ["Professional", "Slate"],
    aliases: [
      "professional",
      "slate",
      "classic",
      "classic business invoice",
      "classic-business",
    ],
  },
  {
    id: "minimal",
    variant: "modern",
    name: "Premium Service Invoice",
    description:
      "Airy premium layout for service businesses that need polished, client-facing invoices.",
    bestFor: "Best for agencies, consultants, studios, and premium service billing.",
    layout: "stacked",
    defaultSections: [
      "header",
      "company_details",
      "client_details",
      "items",
      "tax",
      "payment_info",
      "notes",
      "footer",
    ],
    theme: {
      primaryColor: "#0f766e",
      fontFamily: "var(--font-sora)",
      tableStyle: "modern",
    },
    preferredSourceNames: ["Minimal", "Modern", "Verity"],
    aliases: [
      "minimal",
      "modern",
      "verity",
      "modern minimal invoice",
      "modern-minimal",
    ],
  },
  {
    id: "ledgerline",
    variant: "gst",
    name: "GST Invoice",
    description:
      "Tax-first structure with clear CGST, SGST, and total tax visibility.",
    bestFor: "Best for GST-registered businesses and compliance-heavy billing.",
    layout: "split",
    defaultSections: FULL_INVOICE_SECTIONS,
    theme: {
      primaryColor: "#0c4a6e",
      fontFamily: "var(--font-geist-mono)",
      tableStyle: "grid",
    },
    preferredSourceNames: ["Ledgerline", "Civic"],
    aliases: ["ledgerline", "civic", "gst", "gst invoice", "gst-invoice"],
  },
  {
    id: "indian-gst-template",
    variant: "indianGst",
    name: "Indian GST Invoice Template",
    description:
      "Dedicated Indian GST invoice with Tax Invoice structure, place-of-supply logic, and black-and-white print fidelity.",
    bestFor:
      "Best for Indian shopkeepers, wholesalers, distributors, and freelancers.",
    layout: "stacked",
    defaultSections: FULL_INVOICE_SECTIONS,
    theme: {
      primaryColor: "#111111",
      fontFamily: "var(--font-geist-sans)",
      tableStyle: "minimal",
    },
    preferredSourceNames: [
      "Indian GST Template",
      "Indian GST Invoice Template",
      "Standard GST Invoice",
    ],
    aliases: [
      "indian gst template",
      "indian gst invoice template",
      "indian gst",
      "indian-gst-template",
      "indian modern",
      "indian-modern",
      "indianmodern",
      "templateindianmodern",
      "template indian modern",
      "indian invoice",
      "indian modern invoice",
      "modern tax invoice",
      "indian modern gst invoice",
      "one page gst invoice",
      "standard gst invoice",
    ],
  },
  {
    id: "receipt",
    variant: "compact",
    name: "Compact Retail Invoice",
    description:
      "Faster compact layout for shops and counters that still needs GST-ready structure.",
    bestFor:
      "Best for small shops, retail counters, and quick walk-in billing.",
    layout: "stacked",
    defaultSections: [
      "header",
      "company_details",
      "client_details",
      "items",
      "tax",
      "payment_info",
      "notes",
      "footer",
    ],
    theme: {
      primaryColor: "#b45309",
      fontFamily: "var(--font-geist-sans)",
      tableStyle: "minimal",
    },
    preferredSourceNames: ["Receipt", "Compact", "Retail"],
    aliases: [
      "receipt",
      "compact",
      "retail",
      "compact shop bill",
      "compact-shop",
    ],
  },
  {
    id: "monarch",
    variant: "banner",
    name: "Branded Business Invoice",
    description:
      "Logo-led presentation with a strong branded header and polished balance.",
    bestFor: "Best for agencies, studios, and businesses with strong branding.",
    layout: "stacked",
    defaultSections: FULL_INVOICE_SECTIONS,
    theme: {
      primaryColor: "#7c2d12",
      fontFamily: "var(--font-sora)",
      tableStyle: "modern",
    },
    preferredSourceNames: ["Monarch", "Luxe"],
    aliases: [
      "monarch",
      "luxe",
      "banner",
      "branded business invoice",
      "branded-business",
    ],
  },
  {
    id: "atlas",
    variant: "split",
    name: "Split Layout Invoice",
    description:
      "Invoice details and totals stay separated so long bills stay easy to scan.",
    bestFor: "Best for service businesses and larger multi-line invoices.",
    layout: "split",
    defaultSections: FULL_INVOICE_SECTIONS,
    theme: {
      primaryColor: "#0f766e",
      fontFamily: "var(--font-sora)",
      tableStyle: "modern",
    },
    preferredSourceNames: ["Atlas", "Cascade"],
    aliases: [
      "atlas",
      "cascade",
      "split",
      "split layout invoice",
      "split-layout",
    ],
  },
  {
    id: "apex",
    variant: "bold",
    name: "Highlight Total Invoice",
    description:
      "High-contrast hierarchy that keeps the payable amount impossible to miss.",
    bestFor: "Best for collection-focused teams and payment follow-up flows.",
    layout: "stacked",
    defaultSections: FULL_INVOICE_SECTIONS,
    theme: {
      primaryColor: "#7c2d12",
      fontFamily: "var(--font-fraunces)",
      tableStyle: "modern",
    },
    preferredSourceNames: ["Apex", "Studio", "Kite"],
    aliases: [
      "apex",
      "studio",
      "kite",
      "bold",
      "highlight total invoice",
      "highlight-total",
    ],
  },
  {
    id: "harbor",
    variant: "headerLeft",
    name: "Simple Beginner Invoice",
    description:
      "Straightforward labels and calm structure that reduce confusion for first-time users.",
    bestFor:
      "Best for new businesses that want an easy, beginner-friendly bill.",
    layout: "stacked",
    defaultSections: [
      "header",
      "company_details",
      "client_details",
      "items",
      "tax",
      "payment_info",
      "notes",
      "footer",
    ],
    theme: {
      primaryColor: "#1d4ed8",
      fontFamily: "var(--font-geist-sans)",
      tableStyle: "minimal",
    },
    preferredSourceNames: ["Harbor"],
    aliases: [
      "harbor",
      "headerleft",
      "header-left",
      "simple beginner invoice",
      "simple-beginner",
    ],
  },
  {
    id: "half-page-template",
    variant: "halfPage",
    name: "Half Page Invoice (A5)",
    description:
      "A5 compact layout with GST compliance for small shops wanting less paper.",
    bestFor: "Best for small shops, retail counters, and quick GST billing.",
    layout: "stacked",
    defaultSections: [
      "header",
      "company_details",
      "client_details",
      "items",
      "tax",
      "payment_info",
      "footer",
    ],
    theme: {
      primaryColor: "#111111",
      fontFamily: "var(--font-geist-sans)",
      tableStyle: "minimal",
    },
    preferredSourceNames: ["Half Page A5", "Half Page Invoice"],
    aliases: [
      "half page",
      "half-page",
      "a5",
      "halfpage",
      "half page invoice",
    ],
  },
  {
    id: "mini-invoice-template",
    variant: "mini",
    name: "Mini Invoice",
    description:
      "Ultra-fast minimal invoice for quick billing with minimal fields.",
    bestFor: "Best for Kirana shops, street vendors, and fast billing counters.",
    layout: "stacked",
    defaultSections: ["header", "items", "payment_info", "footer"],
    theme: {
      primaryColor: "#111111",
      fontFamily: "var(--font-geist-mono)",
      tableStyle: "minimal",
    },
    preferredSourceNames: ["Mini Invoice", "Mini"],
    aliases: [
      "mini",
      "mini invoice",
      "fast bill",
      "quick bill",
      "mini-bill",
      "minimal invoice",
    ],
  },
  {
    id: "thermal-receipt-template",
    variant: "thermal",
    name: "Thermal Receipt",
    description:
      "58mm/80mm POS printer receipt, center-aligned for thermal printers.",
    bestFor: "Best for POS thermal printers, street vendors, and mobile billing.",
    layout: "stacked",
    defaultSections: ["header", "items", "payment_info", "footer"],
    theme: {
      primaryColor: "#111111",
      fontFamily: "var(--font-geist-mono)",
      tableStyle: "minimal",
    },
    preferredSourceNames: ["Thermal Receipt", "Thermal"],
    aliases: [
      "thermal",
      "thermal receipt",
      "thermal-printer",
      "pos receipt",
      "pos",
      "receipt",
      "thermal printer receipt",
    ],
  },
];

const normalizeLookupValue = (value?: string | null) => {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

const buildPresetMatcher = (preset: TemplatePreset) => {
  return new Set(
    [
      preset.id,
      preset.variant,
      preset.name,
      ...preset.preferredSourceNames,
      ...preset.aliases,
    ].map((value) => normalizeLookupValue(value)),
  );
};

const PRESET_MATCHERS = CURATED_TEMPLATE_PRESETS.map((preset) => ({
  preset,
  matcher: buildPresetMatcher(preset),
}));

export const resolveInvoiceTemplatePreset = (
  templateId?: string | null,
  templateName?: string | null,
) => {
  const candidates = [templateId, templateName]
    .map((value) => normalizeLookupValue(value))
    .filter(Boolean);

  for (const entry of PRESET_MATCHERS) {
    if (candidates.some((candidate) => entry.matcher.has(candidate))) {
      return entry.preset;
    }
  }

  return null;
};

export const resolveInvoiceTemplateVariant = (
  templateId?: string | null,
  templateName?: string | null,
) => {
  return (
    resolveInvoiceTemplatePreset(templateId, templateName)?.variant ?? "classic"
  );
};

export const decorateInvoiceTemplate = (
  template: InvoiceTemplateConfig,
): InvoiceTemplateConfig => {
  const preset = resolveInvoiceTemplatePreset(template.id, template.name);
  if (!preset) {
    return {
      ...template,
      sectionOrder: template.sectionOrder ?? template.defaultSections,
    };
  }

  return {
    ...template,
    name: preset.name,
    description: preset.description,
    bestFor: preset.bestFor,
    layout: preset.layout,
    defaultSections: [...preset.defaultSections],
    sectionOrder: [...(preset.sectionOrder ?? preset.defaultSections)],
    theme: {
      primaryColor: template.theme.primaryColor || preset.theme.primaryColor,
      fontFamily: template.theme.fontFamily || preset.theme.fontFamily,
      tableStyle: template.theme.tableStyle || preset.theme.tableStyle,
    },
    variant: preset.variant,
  };
};

const matchesPreferredSourceName = (
  template: InvoiceTemplateConfig,
  preset: TemplatePreset,
) => {
  const normalizedName = normalizeLookupValue(template.name);
  return preset.preferredSourceNames.some(
    (value) => normalizeLookupValue(value) === normalizedName,
  );
};

export const buildCuratedTemplateList = (
  templates: InvoiceTemplateConfig[],
): InvoiceTemplateConfig[] => {
  const usedIds = new Set<string>();

  return CURATED_TEMPLATE_PRESETS.map((preset) => {
    const preferredMatch = templates.find((template) => {
      if (usedIds.has(template.id)) return false;
      return matchesPreferredSourceName(template, preset);
    });

    const variantMatch =
      preferredMatch ??
      templates.find((template) => {
        if (usedIds.has(template.id)) return false;
        return (
          resolveInvoiceTemplateVariant(template.id, template.name) ===
          preset.variant
        );
      });

    if (variantMatch) {
      usedIds.add(variantMatch.id);
      return decorateInvoiceTemplate(variantMatch);
    }

    return decorateInvoiceTemplate({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      bestFor: preset.bestFor,
      layout: preset.layout,
      defaultSections: [...preset.defaultSections],
      sectionOrder: [...(preset.sectionOrder ?? preset.defaultSections)],
      theme: { ...preset.theme },
      variant: preset.variant,
    });
  });
};

export const TEMPLATE_CATALOG: InvoiceTemplateConfig[] =
  CURATED_TEMPLATE_PRESETS.map((preset) =>
    decorateInvoiceTemplate({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      bestFor: preset.bestFor,
      layout: preset.layout,
      defaultSections: [...preset.defaultSections],
      sectionOrder: [...(preset.sectionOrder ?? preset.defaultSections)],
      theme: { ...preset.theme },
      variant: preset.variant,
    }),
  );
