import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import TemplateFrame from "./TemplateFrame";

const TemplateBold = (props: InvoiceSectionRendererProps) => {
  return <TemplateFrame variant="bold" {...props} />;
};

export default TemplateBold;
