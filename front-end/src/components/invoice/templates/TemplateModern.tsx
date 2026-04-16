import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import ProductionInvoiceTemplate from "./ProductionInvoiceTemplate";

const TemplateModern = (props: InvoiceSectionRendererProps) => {
  return <ProductionInvoiceTemplate {...props} variant="premium" />;
};

export default TemplateModern;
