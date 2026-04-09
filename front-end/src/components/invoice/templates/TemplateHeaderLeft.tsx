import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import TemplateFrame from "./TemplateFrame";

const TemplateHeaderLeft = (props: InvoiceSectionRendererProps) => {
  return <TemplateFrame variant="headerLeft" {...props} />;
};

export default TemplateHeaderLeft;
