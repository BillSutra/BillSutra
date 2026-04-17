import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import ProductionInvoiceTemplate from "./ProductionInvoiceTemplate";

const TemplateCompact = (props: InvoiceSectionRendererProps) => {
  return <ProductionInvoiceTemplate {...props} variant="compact" />;
};

export default TemplateCompact;
