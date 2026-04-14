import { expect, test } from "playwright/test";

const viewports = [
  {
    name: "desktop",
    size: { width: 1440, height: 1080 },
  },
  {
    name: "mobile",
    size: { width: 390, height: 844 },
  },
] as const;

test.describe("UI visual baselines", () => {
  for (const viewport of viewports) {
    test(`dashboard analytics ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport.size);
      await page.goto("/ui-previews/dashboard-analytics");
      await expect(page.getByTestId("dashboard-analytics-panel")).toBeVisible();
      await expect(
        page.getByTestId("dashboard-analytics-panel"),
      ).toHaveScreenshot(`dashboard-analytics-${viewport.name}.png`);
    });

    test(`profile hub ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport.size);
      await page.goto("/ui-previews/profile-hub");
      await expect(page.getByTestId("profile-hub-layout")).toBeVisible();
      await expect(page.getByTestId("profile-hub-layout")).toHaveScreenshot(
        `profile-hub-${viewport.name}.png`,
      );
    });
  }
});
