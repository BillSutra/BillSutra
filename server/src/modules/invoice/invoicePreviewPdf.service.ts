import { existsSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";
import { getFrontendAppUrl } from "../../lib/appUrls.js";
import type { InvoiceEmailPreviewPayload } from "../../emails/types.js";

const MAX_PAYLOAD_BYTES = 300_000;

const encodePayload = (payload: InvoiceEmailPreviewPayload) =>
  Buffer.from(JSON.stringify(payload)).toString("base64url");

const resolveInvoicePdfExecutablePath = () => {
  const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  const userProfile = process.env.USERPROFILE?.trim();
  const localAppData = process.env.LOCALAPPDATA?.trim();
  const programFiles = process.env.PROGRAMFILES?.trim();
  const programFilesX86 = process.env["PROGRAMFILES(X86)"]?.trim();

  const candidates = [
    localAppData
      ? join(
          localAppData,
          ".chromium-browser-snapshots",
          "chromium",
          "win32-1596254",
          "chrome-win",
          "chrome.exe",
        )
      : null,
    localAppData
      ? join(
          localAppData,
          "ms-playwright",
          "chromium-1208",
          "chrome-win64",
          "chrome.exe",
        )
      : null,
    programFiles
      ? join(programFiles, "Google", "Chrome", "Application", "chrome.exe")
      : null,
    programFilesX86
      ? join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe")
      : null,
    userProfile
      ? join(
          userProfile,
          "AppData",
          "Local",
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        )
      : null,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate));
};

export const renderInvoicePreviewPdfBuffer = async (
  payload: InvoiceEmailPreviewPayload,
) => {
  const serializedPayload = JSON.stringify(payload);
  if (Buffer.byteLength(serializedPayload, "utf8") > MAX_PAYLOAD_BYTES) {
    throw new Error("Invoice preview payload is too large for PDF rendering");
  }

  const encodedPayload = encodePayload(payload);
  const targetUrl = `${getFrontendAppUrl()}/pdf/preview?payload=${encodedPayload}`;
  const executablePath = resolveInvoicePdfExecutablePath();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const timeoutMs = Number(process.env.PDF_RENDER_TIMEOUT_MS ?? 60000);

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1280,
      height: 1810,
      deviceScaleFactor: 2,
    });

    await page.goto(targetUrl, {
      waitUntil: "networkidle0",
      timeout: timeoutMs,
    });
    await page.waitForFunction(
      () => Boolean(document.querySelector("[data-pdf-ready='true']")),
      { timeout: timeoutMs },
    );
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
};
