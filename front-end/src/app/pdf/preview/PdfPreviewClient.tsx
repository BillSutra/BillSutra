"use client";

import { useEffect, useMemo, useState } from "react";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import {
  DesignConfigProvider,
  type DesignConfig,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import InvoiceTemplate from "@/components/invoice/InvoiceTemplate";
import type {
  InvoicePreviewData,
  InvoiceTheme,
  SectionKey,
} from "@/types/invoice-template";

type PreviewPayload = {
  templateId?: string | null;
  templateName?: string | null;
  data: InvoicePreviewData;
  enabledSections: SectionKey[];
  sectionOrder?: SectionKey[];
  theme: InvoiceTheme;
  designConfig?: unknown;
};

const decodePayload = (encoded: string): PreviewPayload | null => {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const raw = atob(padded);
    const parsed = JSON.parse(raw) as PreviewPayload;
    if (!parsed?.data || !parsed?.enabledSections || !parsed?.theme) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const PdfPreviewClient = ({ encodedPayload }: { encodedPayload: string }) => {
  const [ready, setReady] = useState(false);

  const payload = useMemo(
    () => decodePayload(encodedPayload),
    [encodedPayload],
  );

  const designConfig = useMemo(() => {
    return normalizeDesignConfig(
      (payload?.designConfig as Partial<DesignConfig> | null) ?? null,
    );
  }, [payload?.designConfig]);

  useEffect(() => {
    let cancelled = false;

    const markReady = async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      if (!cancelled) {
        setReady(true);
      }
    };

    markReady();

    return () => {
      cancelled = true;
    };
  }, [encodedPayload]);

  if (!payload) {
    return <div data-pdf-ready="true">Invalid payload</div>;
  }

  return (
    <main className="pdf-export min-h-screen bg-white p-0" data-pdf-mode="print">
      <div
        className="mx-auto w-full max-w-[794px]"
        data-pdf-ready={ready ? "true" : "false"}
      >
        <DesignConfigProvider
          value={{
            designConfig,
            updateSection: () => {},
            resetSection: () => {},
            resetAll: () => {},
          }}
        >
          <A4PreviewStack
            stackKey={`pdf-preview-${payload.templateId ?? "default"}-${payload.enabledSections.join(",")}-${(payload.sectionOrder ?? []).join(",")}`}
            pageGapClassName="gap-0"
          >
            <InvoiceTemplate
              templateId={payload.templateId}
              templateName={payload.templateName}
              data={payload.data}
              enabledSections={payload.enabledSections}
              sectionOrder={payload.sectionOrder}
              theme={payload.theme}
            />
          </A4PreviewStack>
        </DesignConfigProvider>
      </div>
      <style>{`
        .pdf-export,
        .pdf-export * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .pdf-export,
        .pdf-export body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #000000;
          font-family: Arial, Helvetica, sans-serif !important;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
        }

        .pdf-export .a4-page-badge {
          display: none !important;
        }

        .pdf-export .a4-preview-page-slot {
          margin: 0 auto;
        }

        .pdf-export .a4-page-frame,
        .pdf-export .a4-page-content,
        .pdf-export [data-template-frame="true"] {
          background: #ffffff !important;
        }

        .pdf-export [data-template-frame="true"],
        .pdf-export [data-template-frame="true"] * {
          text-shadow: none !important;
        }

        .pdf-export [data-template-frame="true"] [class*="shadow"],
        .pdf-export [data-template-frame="true"] [style*="box-shadow"] {
          box-shadow: none !important;
        }

        .pdf-export [data-template-frame="true"] [class*="opacity-"] {
          opacity: 1 !important;
        }

        .pdf-export [data-template-frame="true"] th,
        .pdf-export [data-template-frame="true"] strong {
          color: #000000 !important;
          font-weight: 700 !important;
        }

        .pdf-export [data-template-frame="true"] [class*="font-light"],
        .pdf-export [data-template-frame="true"] [class*="font-normal"] {
          font-weight: 500 !important;
        }

        .pdf-export [data-template-frame="true"] [class*="text-slate-400"],
        .pdf-export [data-template-frame="true"] [class*="text-slate-500"],
        .pdf-export [data-template-frame="true"] [class*="text-slate-600"],
        .pdf-export [data-template-frame="true"] [class*="text-slate-700"],
        .pdf-export [data-template-frame="true"] [class*="text-gray-400"],
        .pdf-export [data-template-frame="true"] [class*="text-gray-500"],
        .pdf-export [data-template-frame="true"] [class*="text-gray-600"],
        .pdf-export [data-template-frame="true"] [class*="text-stone-500"],
        .pdf-export [data-template-frame="true"] [class*="text-stone-600"],
        .pdf-export [data-template-frame="true"] [class*="text-stone-700"] {
          color: #111111 !important;
        }

        .pdf-export [data-template-frame="true"] [class*="text-white/70"],
        .pdf-export [data-template-frame="true"] [class*="text-white/80"] {
          color: #ffffff !important;
        }

        .pdf-export [data-template-frame="true"] [class*="border-slate-100"],
        .pdf-export [data-template-frame="true"] [class*="border-slate-200"],
        .pdf-export [data-template-frame="true"] [class*="border-slate-300"],
        .pdf-export [data-template-frame="true"] [class*="border-stone-100"],
        .pdf-export [data-template-frame="true"] [class*="border-stone-200"],
        .pdf-export [data-template-frame="true"] [class*="border-stone-300"],
        .pdf-export [data-template-frame="true"] table,
        .pdf-export [data-template-frame="true"] th,
        .pdf-export [data-template-frame="true"] td {
          border-color: #222222 !important;
        }

        .pdf-export [data-template-frame="true"] [class*="bg-slate-50"],
        .pdf-export [data-template-frame="true"] [class*="bg-slate-100"],
        .pdf-export [data-template-frame="true"] [class*="bg-stone-50"],
        .pdf-export [data-template-frame="true"] [class*="bg-stone-100"],
        .pdf-export [data-template-frame="true"] [class*="bg-white/"],
        .pdf-export [data-template-frame="true"] [class*="bg-slate-50/"],
        .pdf-export [data-template-frame="true"] [class*="bg-stone-50/"] {
          background: #ffffff !important;
        }

        .pdf-export [data-template-frame="true"] [data-part="status-pill"],
        .pdf-export [data-template-frame="true"] [data-part="invoice-date-card"],
        .pdf-export [data-template-frame="true"] [data-part="logo-lockup"] {
          background: #ffffff !important;
          color: #000000 !important;
          border-color: #222222 !important;
        }

        .pdf-export [data-template-frame="true"] img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
      `}</style>
    </main>
  );
};

export default PdfPreviewClient;
