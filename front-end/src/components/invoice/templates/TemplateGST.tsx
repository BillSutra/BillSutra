import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import TemplateFrame from "./TemplateFrame";

const TemplateGST = (props: InvoiceSectionRendererProps) => {
  return <TemplateFrame variant="gst" {...props} />;
};

export default TemplateGST;
