import fs from "node:fs";
import puppeteer, { type Browser, type Page } from "puppeteer";

const resolveExistingPath = (candidates: Array<string | undefined>) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

const getPlatformCandidates = () => {
  switch (process.platform) {
    case "win32":
      return [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      ];
    case "darwin":
      return [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      ];
    default:
      return [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "/usr/bin/microsoft-edge",
        "/usr/bin/microsoft-edge-stable",
      ];
  }
};

export const resolvePuppeteerExecutablePath = () => {
  return resolveExistingPath([
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    process.env.BROWSER_EXECUTABLE_PATH,
    ...getPlatformCandidates(),
  ]);
};

export const launchPuppeteerBrowser = async () => {
  const executablePath = resolvePuppeteerExecutablePath();

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
};

let sharedBrowserPromise: Promise<Browser> | null = null;

const resetSharedBrowser = () => {
  sharedBrowserPromise = null;
};

export const getSharedPuppeteerBrowser = async (): Promise<Browser> => {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchPuppeteerBrowser()
      .then((browser) => {
        browser.once("disconnected", resetSharedBrowser);
        return browser;
      })
      .catch((error) => {
        resetSharedBrowser();
        throw error;
      });
  }

  const browser = await sharedBrowserPromise;
  if (!browser.connected) {
    resetSharedBrowser();
    return getSharedPuppeteerBrowser();
  }

  return browser;
};

export const withPuppeteerPage = async <T>(
  task: (page: Page) => Promise<T>,
) => {
  const browser = await getSharedPuppeteerBrowser();
  const page = await browser.newPage();

  try {
    return await task(page);
  } finally {
    await page.close().catch(() => undefined);
  }
};
