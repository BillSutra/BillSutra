import prisma from "../config/db.config.js";
import {
  fetchAnalyticsSourceBounds,
  getAnalyticsDailyStatsSupportStatus,
  initializeAnalyticsDailyStatsSupport,
  rebuildAnalyticsDailyStatsRange,
} from "../services/analyticsDailyStats.service.js";

const parseUserIdArg = () => {
  const match = process.argv
    .slice(2)
    .map((arg) => arg.trim())
    .find((arg) => arg.startsWith("--userId="));

  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match.slice("--userId=".length), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const backfillUser = async (userId: number) => {
  const bounds = await fetchAnalyticsSourceBounds(userId);
  if (!bounds) {
    console.info("[analytics.backfill] no source data", { userId });
    return;
  }

  const rows = await rebuildAnalyticsDailyStatsRange({
    userId,
    start: bounds.start,
    endExclusive: bounds.endExclusive,
  });

  console.info("[analytics.backfill] completed", {
    userId,
    startDate: bounds.start.toISOString(),
    endDate: bounds.endExclusive.toISOString(),
    rowCount: rows.length,
  });
};

const main = async () => {
  const support = await initializeAnalyticsDailyStatsSupport();
  if (support.mode !== "preaggregated") {
    console.error(
      "[analytics.backfill] analytics_daily_stats is unavailable. Apply migrations before backfilling.",
      support,
    );
    process.exit(1);
  }

  const requestedUserId = parseUserIdArg();
  if (requestedUserId) {
    await backfillUser(requestedUserId);
    return;
  }

  const users = await prisma.user.findMany({
    where: { deleted_at: null },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  for (const user of users) {
    await backfillUser(user.id);
  }

  console.info("[analytics.backfill] all users completed", {
    totalUsers: users.length,
    support: getAnalyticsDailyStatsSupportStatus(),
  });
};

void main()
  .catch((error) => {
    console.error("[analytics.backfill] failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
