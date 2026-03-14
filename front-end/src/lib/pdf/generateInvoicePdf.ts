import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { InvoicePdfInput } from "@/types/invoice";

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const DEFAULT_FILE_NAME = "invoice-preview.pdf";

const getTargetElement = (input: InvoicePdfInput) => {
  if (input.element instanceof HTMLElement) return input.element;
  if (input.elementId) return document.getElementById(input.elementId);
  if (input.selector) {
    const selected = document.querySelector(input.selector);
    return selected instanceof HTMLElement ? selected : null;
  }
  return null;
};

const nextFrame = () => {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
};

const waitForStableLayout = async () => {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  // Allow pending style and layout work to settle before rasterizing.
  await nextFrame();
  await nextFrame();
};

const capturePageCanvas = async (
  pageElement: HTMLElement,
  imageType: "png" | "jpeg",
  quality: number,
) => {
  const frameElement =
    pageElement.querySelector<HTMLElement>(".a4-page-frame") ?? pageElement;

  const canvas = await html2canvas(frameElement, {
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
    scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
    imageTimeout: 0,
  });

  return canvas.toDataURL(
    imageType === "jpeg" ? "image/jpeg" : "image/png",
    quality,
  );
};

export const generateInvoicePdf = async (input: InvoicePdfInput) => {
  if (input.previewPayload) {
    const response = await fetch("/api/pdf/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: input.fileName,
        payload: input.previewPayload,
      }),
    });

    if (!response.ok) {
      throw new Error("Server-side PDF render failed");
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = input.fileName ?? DEFAULT_FILE_NAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
    return;
  }

  const targetElement = getTargetElement(input);
  if (!targetElement) {
    throw new Error("Preview element not found for PDF export");
  }

  await waitForStableLayout();

  const pageElements = Array.from(
    targetElement.querySelectorAll<HTMLElement>(".invoice-page"),
  );
  const pages = pageElements.length ? pageElements : [targetElement];

  const imageType = input.imageType ?? "png";
  const quality = input.quality ?? 1;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [A4_WIDTH_PX, A4_HEIGHT_PX],
    compress: true,
    putOnlyUsedFonts: true,
  });

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const imageData = await capturePageCanvas(page, imageType, quality);

    if (index > 0) {
      pdf.addPage([A4_WIDTH_PX, A4_HEIGHT_PX], "portrait");
    }

    pdf.addImage(
      imageData,
      imageType === "jpeg" ? "JPEG" : "PNG",
      0,
      0,
      A4_WIDTH_PX,
      A4_HEIGHT_PX,
      undefined,
      "FAST",
    );
  }

  pdf.save(input.fileName ?? DEFAULT_FILE_NAME);
};
