import "dotenv/config";
import app from "./app.js";
import { startInventoryInsightsCron } from "./jobs/inventoryInsights.job.js";
import { startRecurringInvoiceCron } from "./jobs/recurringInvoice.job.js";
import {
  flushObservability,
  initServerObservability,
} from "./lib/observability.js";

const requiredEnv = ["JWT_SECRET"] as const;

const missingEnv = requiredEnv.filter((key) => {
  const value = process.env[key];
  return !value || value.trim().length === 0;
});

if (missingEnv.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missingEnv.join(", ")}`,
  );
}

const PORT = process.env.PORT || 7000;

initServerObservability();
startRecurringInvoiceCron();
startInventoryInsightsCron();

app.listen(PORT, () => console.log(`Server is running on PORT ${PORT}`));

process.on("beforeExit", () => {
  void flushObservability();
});
