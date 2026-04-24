"use client";

import {
  DesignConfigProvider,
  type DesignConfig,
} from "@/components/invoice/DesignConfigContext";
import InvoiceTemplate from "@/components/invoice/InvoiceTemplate";
import type { InvoiceTheme, SectionKey } from "@/types/invoice-template";
import type { InvoicePreviewData } from "@/types/invoice-template";

type InvoicePrintProps = {
  data: InvoicePreviewData;
  templateId?: string | null;
  templateName?: string | null;
  enabledSections: SectionKey[];
  sectionOrder: SectionKey[];
  theme: InvoiceTheme;
  designConfig: DesignConfig;
};

const InvoicePrint = ({
  data,
  templateId,
  templateName,
  enabledSections,
  sectionOrder,
  theme,
  designConfig,
}: InvoicePrintProps) => {
  return (
    <DesignConfigProvider
      value={{
        designConfig,
        updateSection: () => {},
        resetSection: () => {},
        resetAll: () => {},
      }}
    >
      <div className="invoice-print-root bg-white text-black">
        <InvoiceTemplate
          templateId={templateId}
          templateName={templateName}
          data={data}
          enabledSections={enabledSections}
          sectionOrder={sectionOrder}
          theme={theme}
        />
      </div>
    </DesignConfigProvider>
  );
};

export default InvoicePrint;
