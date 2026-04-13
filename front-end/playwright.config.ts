import { defineConfig, devices } from "playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3200);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/visual",
  timeout: 45_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.015,
      animations: "disabled",
      caret: "hide",
    },
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
