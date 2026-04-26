import cron from "node-cron";
import { runInvoiceReminderSweep } from "../services/invoiceReminder.service.js";

export const runInvoiceReminderJob = async () => runInvoiceReminderSweep();

export const startInvoiceReminderCron = () => {
  cron.schedule("0 9 * * *", async () => {
    await runInvoiceReminderJob();
  });
};
