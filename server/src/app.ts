import express from "express";
import type { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import type { CorsOptions } from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import AppError from "./utils/AppError.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import { requestObservabilityMiddleware } from "./lib/observability.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();
const defaultCorsOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
const configuredCorsOrigins = (
  process.env.CORS_ORIGINS ??
  process.env.CORS_ORIGIN ??
  process.env.FRONTEND_URL ??
  process.env.APP_URL ??
  process.env.CLIENT_URL ??
  ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigins = new Set([...defaultCorsOrigins, ...configuredCorsOrigins]);
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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files (logos, payment proofs, etc.) as static assets.
// Storage services write to <server-root>/uploads, so the static root needs
// to resolve there in both tsx dev mode and compiled dist mode.
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "../uploads")),
);

app.get("/", (_req: Request, res: Response) => {
  return res.send("It's working ....");
});

app.use("/api", (await import("./routes/index.js")).default);

app.use((req: Request, _res: Response, next: NextFunction) => {
  return next(new AppError("Route not found", 404));
});

app.use(errorMiddleware);

export default app;
