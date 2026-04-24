import { chromium } from "playwright";

type TimeoutOptions = {
  timeoutMs: number;
  timeoutMessage: string;
};

type RetryOptions = {
  retries: number;
  delayMs: number;
};

type RenderPdfOptions = {
  targetUrl: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

export const runWithTimeout = async <T>(
  run: () => Promise<T>,
  options: TimeoutOptions,
): Promise<T> => {
  const { timeoutMs, timeoutMessage } = options;

  return await Promise.race([
    run(),
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    }),
  ]);
};

export const runWithRetry = async <T>(
  run: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const maxAttempts = Math.max(1, options.retries + 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await run(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("PDF render failed after retries");
};

export const renderPdfWithPlaywright = async ({
  targetUrl,
  timeoutMs = 60000,
  retries = 1,
  retryDelayMs = 300,
}: RenderPdfOptions): Promise<Uint8Array> => {
  return await runWithRetry(
    async () => {
      return await runWithTimeout(
        async () => {
          let browser;
          try {
            browser = await chromium.launch({
              headless: true,
              args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });

            const page = await browser.newPage({
              viewport: { width: 1280, height: 1810 },
              deviceScaleFactor: 2,
            });

            await page.goto(targetUrl, {
              waitUntil: "networkidle",
              timeout: timeoutMs,
            });
            await page.waitForSelector("[data-pdf-ready='true']", {
              timeout: timeoutMs,
            });
            await page.emulateMedia({ media: "print" });

            const pdf = await page.pdf({
              format: "A4",
              printBackground: true,
              preferCSSPageSize: true,
              margin: { top: "0", right: "0", bottom: "0", left: "0" },
            });

            return new Uint8Array(pdf);
          } finally {
            if (browser) {
              await browser.close();
            }
          }
        },
        {
          timeoutMs,
          timeoutMessage: `PDF render timed out after ${timeoutMs}ms`,
        },
      );
    },
    {
      retries,
      delayMs: retryDelayMs,
    },
  );
};
