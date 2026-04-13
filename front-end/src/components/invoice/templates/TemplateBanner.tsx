import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import TemplateFrame from "./TemplateFrame";

const TemplateBanner = (props: InvoiceSectionRendererProps) => {
  return <TemplateFrame variant="banner" {...props} />;
};

export default TemplateBanner;
