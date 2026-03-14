import InvoiceRenderer, {
  type InvoiceRendererProps,
} from "@/components/invoice/InvoiceRenderer";

export type TemplatePreviewRendererProps = InvoiceRendererProps & {
  templateId?: string | null;
};

export const InvoiceTemplate1 = (props: InvoiceRendererProps) => {
  return <InvoiceRenderer {...props} />;
};

export const InvoiceTemplate2 = (props: InvoiceRendererProps) => {
  return <InvoiceRenderer {...props} />;
};

export const InvoiceTemplate3 = (props: InvoiceRendererProps) => {
  return <InvoiceRenderer {...props} />;
};

const templates = {
  modern: InvoiceTemplate1,
  classic: InvoiceTemplate2,
  minimal: InvoiceTemplate3,
} as const;

const modernTemplateIds = new Set([
  "modern",
  "luxe",
  "studio",
  "apex",
  "verve",
]);

const classicTemplateIds = new Set([
  "professional",
  "slate",
  "ledgerline",
  "atlas",
  "harbor",
  "verity",
  "monarch",
]);

const resolveTemplateVariant = (templateId?: string | null) => {
  const normalized = (templateId ?? "").trim().toLowerCase();
  if (modernTemplateIds.has(normalized)) return "modern" as const;
  if (classicTemplateIds.has(normalized)) return "classic" as const;
  return "minimal" as const;
};

const TemplatePreviewRenderer = ({
  templateId,
  ...rendererProps
}: TemplatePreviewRendererProps) => {
  const SelectedTemplate = templates[resolveTemplateVariant(templateId)];
  return <SelectedTemplate {...rendererProps} />;
};

export default TemplatePreviewRenderer;
