import InvoiceRenderer, {
  type InvoiceRendererProps,
} from "@/components/invoice/InvoiceRenderer";

export type TemplatePreviewRendererProps = InvoiceRendererProps;

const TemplatePreviewRenderer = (props: TemplatePreviewRendererProps) => {
  return <InvoiceRenderer {...props} />;
};

export default TemplatePreviewRenderer;
