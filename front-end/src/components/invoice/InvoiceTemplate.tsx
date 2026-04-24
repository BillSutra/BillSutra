"use client";

import TemplatePreviewRenderer, {
  type TemplatePreviewRendererProps,
} from "@/components/invoice/TemplatePreviewRenderer";

export type InvoiceTemplateProps = TemplatePreviewRendererProps;

const InvoiceTemplate = (props: InvoiceTemplateProps) => {
  return <TemplatePreviewRenderer {...props} />;
};

export default InvoiceTemplate;
