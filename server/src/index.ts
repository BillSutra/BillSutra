import "dotenv/config";
import app from "./app.js";
import { startRecurringInvoiceCron } from "./jobs/recurringInvoice.job.js";
import {
  flushObservability,
  initServerObservability,
} from "./lib/observability.js";

const PORT = process.env.PORT || 7000;

initServerObservability();
startRecurringInvoiceCron();

app.listen(PORT, () => console.log(`Server is running on PORT ${PORT}`));

process.on("beforeExit", () => {
  void flushObservability();
});
