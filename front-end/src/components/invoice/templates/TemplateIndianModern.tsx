import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import TemplateIndianGst from "./TemplateIndianGst";

const TemplateIndianModern = (props: InvoiceSectionRendererProps) => {
  return <TemplateIndianGst {...props} />;
};

export default TemplateIndianModern;
