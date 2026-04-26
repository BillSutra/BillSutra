import cron from "node-cron";
import prisma from "../config/db.config.js";
import {
  dispatchLowStockAlertEmail,
  hasLowStockAlertBeenSentToday,
} from "../services/notificationEmail.service.js";

export const runLowStockAlertJob = async () => {
  const users = await prisma.user.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      id: true,
    },
  });

  for (const user of users) {
    try {
      const alreadySent = await hasLowStockAlertBeenSentToday(user.id);
      if (alreadySent) {
        continue;
      }

      await dispatchLowStockAlertEmail(user.id);
    } catch (error) {
      console.warn("[email] low stock alert scheduling failed", {
        userId: user.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

export const startLowStockAlertCron = () => {
  cron.schedule("30 9 * * *", async () => {
    await runLowStockAlertJob();
  });
};
