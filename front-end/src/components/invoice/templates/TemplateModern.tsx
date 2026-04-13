import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import TemplateFrame from "./TemplateFrame";

const TemplateModern = (props: InvoiceSectionRendererProps) => {
  return <TemplateFrame variant="modern" {...props} />;
};

export default TemplateModern;
