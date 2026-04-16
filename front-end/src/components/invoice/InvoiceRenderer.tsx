import React from "react";
import type {
  InvoicePreviewData,
  InvoiceSectionProps,
  InvoiceTheme,
  SectionKey,
} from "@/types/invoice-template";
import { resolveInvoiceTemplateVariant } from "@/lib/invoiceTemplateData";
import Header from "./sections/Header";
import CompanyDetails from "./sections/CompanyDetails";
import ClientDetails from "./sections/ClientDetails";
import ItemsTable from "./sections/ItemsTable";
import ServiceItemsTable from "./sections/ServiceItemsTable";
import TaxSection from "./sections/TaxSection";
import DiscountSection from "./sections/DiscountSection";
import PaymentInfo from "./sections/PaymentInfo";
import Notes from "./sections/Notes";
import Footer from "./sections/Footer";
import TemplateBanner from "./templates/TemplateBanner";
import TemplateBold from "./templates/TemplateBold";
import TemplateClassic from "./templates/TemplateClassic";
import TemplateCompact from "./templates/TemplateCompact";
import TemplateGST from "./templates/TemplateGST";
import TemplateHeaderLeft from "./templates/TemplateHeaderLeft";
import TemplateIndianGst from "./templates/TemplateIndianGst";
import TemplateIndianModern from "./templates/TemplateIndianModern";
import TemplateModern from "./templates/TemplateModern";
import TemplateSplit from "./templates/TemplateSplit";
import TemplateHalfPage from "./templates/TemplateHalfPage";
import TemplateMini from "./templates/TemplateMini";
import TemplateThermal from "./templates/TemplateThermal";

const SECTION_MAP: Record<
  SectionKey,
  (props: InvoiceSectionProps) => React.JSX.Element
> = {
  header: Header,
  company_details: CompanyDetails,
  client_details: ClientDetails,
  items: ItemsTable,
  service_items: ServiceItemsTable,
  tax: TaxSection,
  discount: DiscountSection,
  payment_info: PaymentInfo,
  notes: Notes,
  footer: Footer,
};

export type InvoiceSectionRendererProps = {
  data: InvoicePreviewData;
  enabledSections: SectionKey[];
  sectionOrder?: SectionKey[];
  theme: InvoiceTheme;
};

export type InvoiceRendererProps = InvoiceSectionRendererProps & {
  templateId?: string | null;
  templateName?: string | null;
};

export const InvoiceSectionRenderer = ({
  data,
  enabledSections,
  sectionOrder,
  theme,
}: InvoiceSectionRendererProps) => {
  const order = (sectionOrder?.length ? sectionOrder : enabledSections).filter(
    (section) => enabledSections.includes(section),
  );

  return (
    <div
      className="invoice-content-root"
      data-table-style={theme.tableStyle}
      style={{
        fontFamily: theme.fontFamily,
      }}
    >
      {order.map((section) => {
        const SectionComponent = SECTION_MAP[section];
        return (
          <div key={section} className="invoice-section" data-section={section}>
            <SectionComponent data={data} theme={theme} />
          </div>
        );
      })}
    </div>
  );
};

const TEMPLATE_MAP = {
  classic: TemplateClassic,
  modern: TemplateModern,
  indianGst: TemplateIndianGst,
  indianModern: TemplateIndianModern,
  gst: TemplateGST,
  headerLeft: TemplateHeaderLeft,
  banner: TemplateBanner,
  split: TemplateSplit,
  compact: TemplateCompact,
  bold: TemplateBold,
  halfPage: TemplateHalfPage,
  mini: TemplateMini,
  thermal: TemplateThermal,
} as const;

const InvoiceRenderer = ({
  templateId,
  templateName,
  ...rendererProps
}: InvoiceRendererProps) => {
  const variant = resolveInvoiceTemplateVariant(templateId, templateName);
  const SelectedTemplate = TEMPLATE_MAP[variant] ?? TEMPLATE_MAP.classic;

  return <SelectedTemplate {...rendererProps} />;
};

export default InvoiceRenderer;
