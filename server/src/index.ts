import "dotenv/config";
import { createServer } from "http";
import app from "./app.js";
import { startInventoryInsightsCron } from "./jobs/inventoryInsights.job.js";
import { startMonthlySalesReportCron } from "./jobs/monthlySalesReport.job.js";
import { startRecurringInvoiceCron } from "./jobs/recurringInvoice.job.js";
import { ensureSchemaCompatibility } from "./lib/schemaCompatibility.js";
import {
  flushObservability,
  initServerObservability,
} from "./lib/observability.js";
import { initRealtimeSocketServer } from "./services/realtimeSocket.service.js";

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

await ensureSchemaCompatibility();

initServerObservability();
startRecurringInvoiceCron();
startInventoryInsightsCron();
startMonthlySalesReportCron();

const server = createServer(app);

try {
  initRealtimeSocketServer(server);
} catch (error) {
  console.warn("[socket] realtime server initialization failed", {
    error: error instanceof Error ? error.message : String(error),
  });
}

server.listen(PORT, () => console.log(`Server is running on PORT ${PORT}`));

process.on("beforeExit", () => {
  void flushObservability();
});
