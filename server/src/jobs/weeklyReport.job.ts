import cron from "node-cron";
import prisma from "../config/db.config.js";
import {
  dispatchWeeklyReportEmail,
  hasWeeklyReportBeenSent,
  resolveWeeklyReportWindow,
} from "../services/notificationEmail.service.js";

export const runWeeklyReportJob = async () => {
  const window = resolveWeeklyReportWindow();
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
      const alreadySent = await hasWeeklyReportBeenSent({
        userId: user.id,
        weekKey: window.weekKey,
      });
      if (alreadySent) {
        continue;
      }

      await dispatchWeeklyReportEmail(user.id, window.weekKey);
    } catch (error) {
      console.warn("[email] weekly report scheduling failed", {
        userId: user.id,
        weekKey: window.weekKey,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

export const startWeeklyReportCron = () => {
  cron.schedule("0 8 * * 1", async () => {
    await runWeeklyReportJob();
  });
};
