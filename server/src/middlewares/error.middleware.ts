import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import AppError from "../utils/AppError.js";
import { captureServerException } from "../lib/observability.js";

type ErrorWithStatus = Error & {
  status?: number;
  statusCode?: number;
};

const mapPrismaKnownError = (
  error: Prisma.PrismaClientKnownRequestError,
): { statusCode: number; message: string } => {
  switch (error.code) {
    case "P2002":
      return { statusCode: 409, message: "Resource already exists" };
    case "P2025":
      return { statusCode: 404, message: "Record not found" };
    case "P2022":
      return {
        statusCode: 500,
        message:
          "Database schema is out of sync with the API. Run Prisma migrations and restart the server.",
      };
    case "P2021":
      return {
        statusCode: 503,
        message:
          "Database schema is out of sync with the API. Run Prisma migrations and restart the server.",
      };
    default:
      return { statusCode: 400, message: "Database request failed" };
  }
};

const errorMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  let statusCode = 500;
  let message = "Internal Server Error";
  let data: Record<string, unknown> | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaKnownError(err);
    statusCode = mapped.statusCode;
    message = mapped.message;
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = "Invalid database input";
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503;
    message = "Database connection failed";
  } else if (err instanceof ZodError) {
    statusCode = 422;
    message = "Validation failed";
    data = { errors: err.flatten().fieldErrors };
  } else if (err instanceof Error) {
    const appLikeError = err as ErrorWithStatus;
    statusCode = appLikeError.statusCode ?? appLikeError.status ?? 500;
    message = err.message || message;
  }

  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    console.error(err);
  }

  if (statusCode >= 500) {
    captureServerException(err, req, {
      level: "error",
      tags: {
        status_code: statusCode,
        error_type: err instanceof Error ? err.name : "unknown_error",
      },
      extra: {
        responseMessage: message,
      },
    });
  }

  const response: {
    success: false;
    message: string;
    data?: Record<string, unknown>;
  } = {
    success: false,
    message,
  };

  if (data && Object.keys(data).length > 0) {
    response.data = data;
  }

  if (!isProd && err instanceof Error) {
    response.data = {
      ...(response.data ?? {}),
      stack: err.stack,
    };
  }

  return res.status(statusCode).json(response);
};

export default errorMiddleware;
