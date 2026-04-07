import express from "express";
import type { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import AppError from "./utils/AppError.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import { requestObservabilityMiddleware } from "./lib/observability.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();

app.use(requestObservabilityMiddleware);

// Logs: METHOD route status response-time (e.g. GET /invoices 200 45ms)
app.use(morgan(":method :url :status :response-time[0]ms"));
app.use(cors());
app.use(
  "/api/payments/access/webhooks/razorpay",
  express.raw({ type: "application/json" }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files (logos, etc.) as static assets.
// URL pattern: GET /uploads/logos/<userId>/<filename>
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "../../uploads")),
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
