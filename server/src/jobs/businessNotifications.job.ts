import cron from "node-cron";
import { syncNotificationsForAllUsers } from "../services/notification.service.js";

export const runBusinessNotificationsJob = async () => {
  await syncNotificationsForAllUsers();
};

export const startBusinessNotificationsCron = () => {
  cron.schedule("0 * * * *", async () => {
    await runBusinessNotificationsJob();
  });
};
