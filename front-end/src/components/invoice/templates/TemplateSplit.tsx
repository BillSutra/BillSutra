import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import TemplateFrame from "./TemplateFrame";

const TemplateSplit = (props: InvoiceSectionRendererProps) => {
  return <TemplateFrame variant="split" {...props} />;
};

export default TemplateSplit;
