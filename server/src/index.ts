import { createServer } from "http";
import {
  DatabaseUrlValidationError,
  initializeDatabaseConnections,
  logDatabaseStartupDiagnostics,
  logDatabaseStartupFailure,
} from "./config/databaseUrl.js";
import { loadServerEnv } from "./config/loadEnv.js";
import {
  initializeRedisConfig,
  logRedisStartupDiagnostics,
  logRedisStartupFailure,
  RedisConfigValidationError,
} from "./config/redisConfig.js";
import {
  logAuthSecretDiagnostics,
  resolveAuthSecrets,
} from "./lib/authSecrets.js";
import { validateSecurityEnv } from "./lib/securityEnv.js";

loadServerEnv();

const {
  captureObservabilityException,
  flushObservability,
  initServerObservability,
} = await import("./lib/observability.js");

validateSecurityEnv();
logAuthSecretDiagnostics(resolveAuthSecrets());
await initServerObservability();

const PORT = process.env.PORT || 7000;
const ENABLE_SCHEDULER =
  process.env.ENABLE_SCHEDULER?.trim().toLowerCase() !== "false";
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = Math.max(
  Number.parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS ?? "15000", 10) ||
    15000,
  1000,
);

try {
  const resolvedDatabaseConfig = initializeDatabaseConnections();
  const resolvedRedisConfig = initializeRedisConfig();
  logDatabaseStartupDiagnostics(resolvedDatabaseConfig);
  logRedisStartupDiagnostics(resolvedRedisConfig);

  const { verifyDatabaseConnectivity } = await import("./config/db.config.js");

  try {
    const connectivity = await verifyDatabaseConnectivity();

    console.info("[startup.db] connection established", {
      durationMs: connectivity?.durationMs ?? null,
      database: connectivity?.database ?? null,
      currentUser: connectivity?.currentUser ?? null,
    });
  } catch (error) {
    logDatabaseStartupFailure(error);
    throw error;
  }

  const [
    { default: app },
    { startInventoryInsightsCron },
    { startInvoiceReminderCron },
    { startLowStockAlertCron },
    { startMonthlySalesReportCron },
    { startBusinessNotificationsCron },
    { startRecurringInvoiceCron },
    { startWeeklyReportCron },
    { ensureSchemaCompatibility },
    { initializeAnalyticsDailyStatsSupport },
    { initRealtimeSocketServer, shutdownRealtimeSocketServer },
    { disconnectDatabase },
    { disconnectRedisClients },
  ] = await Promise.all([
    import("./app.js"),
    import("./jobs/inventoryInsights.job.js"),
    import("./jobs/invoiceReminder.job.js"),
    import("./jobs/lowStockAlert.job.js"),
    import("./jobs/monthlySalesReport.job.js"),
    import("./jobs/businessNotifications.job.js"),
    import("./jobs/recurringInvoice.job.js"),
    import("./jobs/weeklyReport.job.js"),
    import("./lib/schemaCompatibility.js"),
    import("./services/analyticsDailyStats.service.js"),
    import("./services/realtimeSocket.service.js"),
    import("./config/db.config.js"),
    import("./redis/redisClient.js"),
  ]);

  await ensureSchemaCompatibility();
  console.info("[startup.db] schema compatibility completed");

  const analyticsSupport = await initializeAnalyticsDailyStatsSupport();
  console.info("[startup.analytics] daily stats mode resolved", analyticsSupport);

  if (ENABLE_SCHEDULER) {
    startRecurringInvoiceCron();
    startInventoryInsightsCron();
    startMonthlySalesReportCron();
    startBusinessNotificationsCron();
    startInvoiceReminderCron();
    startWeeklyReportCron();
    startLowStockAlertCron();
    console.info("[startup.jobs] schedulers enabled");
  } else {
    console.info("[startup.jobs] schedulers disabled for this process");
  }

  const server = createServer(app);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 30_000;

  try {
    initRealtimeSocketServer(server);
  } catch (error) {
    console.warn("[socket] realtime server initialization failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  server.listen(PORT, () =>
    console.info("[startup] server listening", { port: Number(PORT) }),
  );

  let shutdownStarted = false;

  const shutdown = async (signal: string, exitCode: number) => {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;

    console.info("[startup] graceful shutdown requested", {
      signal,
      timeoutMs: GRACEFUL_SHUTDOWN_TIMEOUT_MS,
    });

    const forcedExitTimer = setTimeout(() => {
      console.error("[startup] graceful shutdown timed out", { signal });
      process.exit(exitCode || 1);
    }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);
    forcedExitTimer.unref();

    try {
      await shutdownRealtimeSocketServer();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    } catch (error) {
      console.error("[startup] http shutdown failed", {
        signal,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    await Promise.allSettled([
      disconnectDatabase(),
      disconnectRedisClients(),
      flushObservability(),
    ]);

    clearTimeout(forcedExitTimer);
    process.exit(exitCode);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT", 0);
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM", 0);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[startup] unhandled promise rejection", {
      message: reason instanceof Error ? reason.message : String(reason),
    });
    captureObservabilityException(
      reason instanceof Error ? reason : new Error(String(reason)),
      {
        level: "fatal",
        tags: {
          component: "server",
          lifecycle: "unhandled_rejection",
        },
      },
    );
    void shutdown("unhandledRejection", 1);
  });

  process.on("uncaughtException", (error) => {
    console.error("[startup] uncaught exception", {
      message: error.message,
      stack: error.stack,
    });
    captureObservabilityException(error, {
      level: "fatal",
      tags: {
        component: "server",
        lifecycle: "uncaught_exception",
      },
    });
    void shutdown("uncaughtException", 1);
  });

  process.on("beforeExit", () => {
    void flushObservability();
  });
} catch (error) {
  if (error instanceof DatabaseUrlValidationError) {
    logDatabaseStartupFailure(error);
  }
  if (error instanceof RedisConfigValidationError) {
    logRedisStartupFailure(error);
  }
  console.error("[startup] failed to boot", {
    message: error instanceof Error ? error.message : String(error),
  });
  captureObservabilityException(
    error instanceof Error ? error : new Error(String(error)),
    {
      level: "fatal",
      tags: {
        component: "server",
        lifecycle: "startup",
      },
    },
  );
  await flushObservability();
  process.exit(1);
}
