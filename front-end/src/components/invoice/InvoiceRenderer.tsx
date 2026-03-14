import React from "react";
import type {
  InvoicePreviewData,
  InvoiceTheme,
  InvoiceSectionProps,
  SectionKey,
} from "@/types/invoice-template";
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

export type InvoiceRendererProps = {
  data: InvoicePreviewData;
  enabledSections: SectionKey[];
  sectionOrder?: SectionKey[];
  theme: InvoiceTheme;
};

const InvoiceRenderer = ({
  data,
  enabledSections,
  sectionOrder,
  theme,
}: InvoiceRendererProps) => {
  const order = (sectionOrder?.length ? sectionOrder : enabledSections).filter(
    (section) => enabledSections.includes(section),
  );

  return (
    <div
      className="invoice-content-root space-y-1"
      style={{
        fontFamily: theme.fontFamily,
      }}
    >
      {order.map((section) => {
        const SectionComponent = SECTION_MAP[section];
        return (
          <div key={section} className="invoice-section">
            <SectionComponent data={data} theme={theme} />
          </div>
        );
      })}
    </div>
  );
};

export default InvoiceRenderer;
