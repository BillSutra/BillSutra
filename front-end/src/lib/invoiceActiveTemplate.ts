import {
  normalizeDesignConfig,
  type DesignConfig,
} from "@/components/invoice/DesignConfigContext";
import { TEMPLATE_CATALOG } from "@/lib/invoiceTemplateData";
import type { InvoiceTheme, SectionKey } from "@/types/invoice-template";

export const ACTIVE_INVOICE_TEMPLATE_STORAGE_KEY =
  "billsutra.invoice.active-template";
export const ACTIVE_INVOICE_TEMPLATE_EVENT =
  "billsutra:active-invoice-template-updated";

const SECTION_KEYS: SectionKey[] = [
  "header",
  "company_details",
  "client_details",
  "items",
  "service_items",
  "tax",
  "discount",
  "payment_info",
  "notes",
  "footer",
];

const SECTION_KEY_SET = new Set<SectionKey>(SECTION_KEYS);
const TABLE_STYLE_SET = new Set<InvoiceTheme["tableStyle"]>([
  "minimal",
  "grid",
  "modern",
]);

export type ActiveInvoiceTemplateInput = {
  templateId: string;
  templateName?: string | null;
  enabledSections: SectionKey[];
  sectionOrder?: SectionKey[];
  theme: InvoiceTheme;
  designConfig?: Partial<DesignConfig> | null;
};

export type ActiveInvoiceTemplateSnapshot = {
  templateId: string;
  templateName?: string | null;
  enabledSections: SectionKey[];
  sectionOrder: SectionKey[];
  theme: InvoiceTheme;
  designConfig: DesignConfig;
};

const DEFAULT_TEMPLATE =
  TEMPLATE_CATALOG.find((template) => template.id === "indian-gst-template") ??
  TEMPLATE_CATALOG[0];

export const DEFAULT_ACTIVE_INVOICE_TEMPLATE: ActiveInvoiceTemplateInput = {
  templateId: DEFAULT_TEMPLATE.id,
  templateName: DEFAULT_TEMPLATE.name,
  enabledSections: DEFAULT_TEMPLATE.defaultSections,
  sectionOrder:
    DEFAULT_TEMPLATE.sectionOrder ?? DEFAULT_TEMPLATE.defaultSections,
  theme: DEFAULT_TEMPLATE.theme,
  designConfig: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const normalizeSectionList = (
  value: unknown,
  fallback: SectionKey[],
): SectionKey[] => {
  if (!Array.isArray(value)) return [...fallback];

  const normalized = value.filter(
    (entry): entry is SectionKey =>
      typeof entry === "string" && SECTION_KEY_SET.has(entry as SectionKey),
  );

  return normalized.length ? normalized : [...fallback];
};

const normalizeTheme = (
  value: unknown,
  fallback: InvoiceTheme,
): InvoiceTheme => {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  return {
    primaryColor:
      typeof value.primaryColor === "string" && value.primaryColor.trim()
        ? value.primaryColor
        : fallback.primaryColor,
    fontFamily:
      typeof value.fontFamily === "string" && value.fontFamily.trim()
        ? value.fontFamily
        : fallback.fontFamily,
    tableStyle:
      typeof value.tableStyle === "string" &&
      TABLE_STYLE_SET.has(value.tableStyle as InvoiceTheme["tableStyle"])
        ? (value.tableStyle as InvoiceTheme["tableStyle"])
        : fallback.tableStyle,
  };
};

export const createActiveInvoiceTemplateSnapshot = ({
  templateId,
  templateName,
  enabledSections,
  sectionOrder,
  theme,
  designConfig,
}: ActiveInvoiceTemplateInput): ActiveInvoiceTemplateSnapshot => {
  const normalizedEnabledSections = normalizeSectionList(
    enabledSections,
    DEFAULT_ACTIVE_INVOICE_TEMPLATE.enabledSections,
  );
  const normalizedSectionOrder = normalizeSectionList(
    sectionOrder,
    normalizedEnabledSections,
  );

  return {
    templateId: templateId.trim() || DEFAULT_ACTIVE_INVOICE_TEMPLATE.templateId,
    templateName: templateName?.trim() || null,
    enabledSections: normalizedEnabledSections,
    sectionOrder: normalizedSectionOrder,
    theme: normalizeTheme(theme, DEFAULT_ACTIVE_INVOICE_TEMPLATE.theme),
    designConfig: normalizeDesignConfig(designConfig ?? null),
  };
};

export const resolveActiveInvoiceTemplate = (
  fallback: ActiveInvoiceTemplateInput = DEFAULT_ACTIVE_INVOICE_TEMPLATE,
): ActiveInvoiceTemplateSnapshot => {
  const normalizedFallback = createActiveInvoiceTemplateSnapshot(fallback);

  if (typeof window === "undefined") {
    return normalizedFallback;
  }

  try {
    const rawValue = window.localStorage.getItem(
      ACTIVE_INVOICE_TEMPLATE_STORAGE_KEY,
    );
    if (!rawValue) {
      return normalizedFallback;
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsed)) {
      return normalizedFallback;
    }

    return {
      templateId:
        typeof parsed.templateId === "string" && parsed.templateId.trim()
          ? parsed.templateId
          : normalizedFallback.templateId,
      templateName:
        typeof parsed.templateName === "string" && parsed.templateName.trim()
          ? parsed.templateName
          : normalizedFallback.templateName,
      enabledSections: normalizeSectionList(
        parsed.enabledSections,
        normalizedFallback.enabledSections,
      ),
      sectionOrder: normalizeSectionList(
        parsed.sectionOrder,
        normalizedFallback.sectionOrder,
      ),
      theme: normalizeTheme(parsed.theme, normalizedFallback.theme),
      designConfig: normalizeDesignConfig(
        isRecord(parsed.designConfig)
          ? (parsed.designConfig as Partial<DesignConfig>)
          : normalizedFallback.designConfig,
      ),
    };
  } catch {
    window.localStorage.removeItem(ACTIVE_INVOICE_TEMPLATE_STORAGE_KEY);
    return normalizedFallback;
  }
};

export const saveActiveInvoiceTemplate = (
  snapshot: ActiveInvoiceTemplateInput,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedSnapshot = createActiveInvoiceTemplateSnapshot(snapshot);
  window.localStorage.setItem(
    ACTIVE_INVOICE_TEMPLATE_STORAGE_KEY,
    JSON.stringify(normalizedSnapshot),
  );
  window.dispatchEvent(
    new CustomEvent(ACTIVE_INVOICE_TEMPLATE_EVENT, {
      detail: normalizedSnapshot,
    }),
  );
};
