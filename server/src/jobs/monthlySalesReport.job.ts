import cron from "node-cron";
import prisma from "../config/db.config.js";
import {
  dispatchMonthlySalesReportEmail,
  resolveMonthlyReportWindow,
} from "../services/email.service.js";

export const runMonthlySalesReportJob = async () => {
  const reportWindow = resolveMonthlyReportWindow();
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
      await dispatchMonthlySalesReportEmail(user.id, reportWindow.monthKey);
    } catch (error) {
      console.warn("[email] monthly report scheduling failed", {
        userId: user.id,
        monthKey: reportWindow.monthKey,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

export const startMonthlySalesReportCron = () => {
  cron.schedule("0 8 1 * *", async () => {
    await runMonthlySalesReportJob();
  });
};
