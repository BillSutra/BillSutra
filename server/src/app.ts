import express from "express";
import type { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import type { CorsOptions } from "cors";
import morgan from "morgan";
import AppError from "./utils/AppError.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import { requestObservabilityMiddleware } from "./lib/observability.js";
import LegacyUploadsController from "./controllers/LegacyUploadsController.js";
import { PUBLIC_UPLOADS_ROOT } from "./lib/uploadPaths.js";
import { getAllowedCorsOrigins } from "./lib/corsOrigins.js";

const app: Application = express();
const corsOrigins = new Set(getAllowedCorsOrigins());
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || corsOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(requestObservabilityMiddleware);

// Logs: METHOD route status response-time (e.g. GET /invoices 200 45ms)
app.use(morgan(":method :url :status :response-time[0]ms"));
app.use(cors(corsOptions));
app.use(
  "/api/payments/access/webhooks/razorpay",
  express.raw({ type: "application/json" }),
);
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: false, limit: "6mb" }));

// Phased upload hardening:
// - new public assets are served only from /uploads/public
// - legacy /uploads/* links stay alive temporarily via a controlled handler
app.use("/uploads/public", express.static(PUBLIC_UPLOADS_ROOT));
app.use("/uploads", LegacyUploadsController.serve);

app.get("/", (_req: Request, res: Response) => {
  return res.send("It's working ....");
});

app.use("/api", (await import("./routes/index.js")).default);

app.use((req: Request, _res: Response, next: NextFunction) => {
  return next(new AppError("Route not found", 404));
});

app.use(errorMiddleware);

export default app;
