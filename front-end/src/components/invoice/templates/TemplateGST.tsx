import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import ProductionInvoiceTemplate from "./ProductionInvoiceTemplate";

const TemplateGST = (props: InvoiceSectionRendererProps) => {
  return <ProductionInvoiceTemplate {...props} variant="standard" />;
};

export default TemplateGST;
