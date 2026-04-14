import cron from "node-cron";
import { warmInventoryInsightsCache } from "../services/inventoryInsights.service.js";

export const runInventoryInsightsJob = async () => {
  await warmInventoryInsightsCache();
};

export const startInventoryInsightsCron = () => {
  cron.schedule("15 0 * * *", async () => {
    await runInventoryInsightsJob();
  });
};
