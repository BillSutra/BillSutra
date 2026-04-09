import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import TemplateFrame from "./TemplateFrame";

const TemplateClassic = (props: InvoiceSectionRendererProps) => {
  return <TemplateFrame variant="classic" {...props} />;
};

export default TemplateClassic;
