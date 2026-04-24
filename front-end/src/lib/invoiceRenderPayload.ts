import {
  normalizeDesignConfig,
  type DesignConfig,
} from "@/components/invoice/DesignConfigContext";
import type {
  InvoicePreviewData,
  InvoiceTheme,
  SectionKey,
} from "@/types/invoice-template";

export type InvoiceRenderPayload = {
  templateId?: string | null;
  templateName?: string | null;
  data: InvoicePreviewData;
  enabledSections: SectionKey[];
  sectionOrder?: SectionKey[];
  theme: InvoiceTheme;
  designConfig?: Partial<DesignConfig> | null;
};

const cloneInvoicePreviewData = (
  data: InvoicePreviewData,
): InvoicePreviewData => ({
  ...data,
  business: {
    ...data.business,
    businessAddress: data.business.businessAddress
      ? { ...data.business.businessAddress }
      : undefined,
  },
  client: { ...data.client },
  items: data.items.map((item) => ({ ...item })),
  totals: data.totals ? { ...data.totals } : undefined,
  discount: data.discount ? { ...data.discount } : undefined,
  paymentSummary: data.paymentSummary
    ? {
        ...data.paymentSummary,
        history: data.paymentSummary.history?.map((entry) => ({ ...entry })),
      }
    : undefined,
  payment: data.payment
    ? {
        ...data.payment,
        extraLines: data.payment.extraLines
          ? [...data.payment.extraLines]
          : undefined,
      }
    : undefined,
});

export const buildInvoiceRenderPayload = ({
  templateId,
  templateName,
  data,
  enabledSections,
  sectionOrder,
  theme,
  designConfig,
}: InvoiceRenderPayload): InvoiceRenderPayload => ({
  templateId: templateId ?? null,
  templateName: templateName ?? null,
  data: cloneInvoicePreviewData(data),
  enabledSections: [...enabledSections],
  sectionOrder: sectionOrder?.length ? [...sectionOrder] : undefined,
  theme: { ...theme },
  designConfig: normalizeDesignConfig(designConfig ?? null),
});
