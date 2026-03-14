"use client";

import { useEffect, useMemo, useState } from "react";
import TemplatePreviewRenderer from "@/components/invoice/TemplatePreviewRenderer";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import {
  DesignConfigProvider,
  type DesignConfig,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import type {
  InvoicePreviewData,
  InvoiceTheme,
  SectionKey,
} from "@/types/invoice-template";

type PreviewPayload = {
  templateId?: string | null;
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
    <main className="pdf-export min-h-screen bg-white p-0">
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
            <TemplatePreviewRenderer
              templateId={payload.templateId}
              data={payload.data}
              enabledSections={payload.enabledSections}
              sectionOrder={payload.sectionOrder}
              theme={payload.theme}
            />
          </A4PreviewStack>
        </DesignConfigProvider>
      </div>
      <style jsx global>{`
        .pdf-export,
        .pdf-export body {
          margin: 0;
          padding: 0;
          background: #fff;
        }

        .pdf-export .a4-page-badge {
          display: none !important;
        }

        .pdf-export .a4-preview-page-slot {
          margin: 0 auto;
        }
      `}</style>
    </main>
  );
};

export default PdfPreviewClient;
