import "dotenv/config";
import app from "./app.js";
import { startRecurringInvoiceCron } from "./jobs/recurringInvoice.job.js";

const PORT = process.env.PORT || 7000;

startRecurringInvoiceCron();

app.listen(PORT, () => console.log(`Server is running on PORT ${PORT}`));
