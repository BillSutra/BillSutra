import InvoiceRenderer, {
  type InvoiceRendererProps,
} from "@/components/invoice/InvoiceRenderer";

export type TemplatePreviewRendererProps = InvoiceRendererProps & {
  templateId?: string | null;
  templateName?: string | null;
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

const resolveTemplateVariant = (
  templateId?: string | null,
  templateName?: string | null,
) => {
  const candidates = [templateId, templateName]
    .map((value) => (value ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (candidates.some((value) => modernTemplateIds.has(value))) {
    return "modern" as const;
  }
  if (candidates.some((value) => classicTemplateIds.has(value))) {
    return "classic" as const;
  }
  return "minimal" as const;
};

const TemplatePreviewRenderer = ({
  templateId,
  templateName,
  ...rendererProps
}: TemplatePreviewRendererProps) => {
  const SelectedTemplate = templates[resolveTemplateVariant(templateId, templateName)];
  return <SelectedTemplate {...rendererProps} />;
};

export default TemplatePreviewRenderer;
