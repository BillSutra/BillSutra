import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import TemplateFrame from "./TemplateFrame";

const TemplateCompact = (props: InvoiceSectionRendererProps) => {
  return <TemplateFrame variant="compact" {...props} />;
};

export default TemplateCompact;
