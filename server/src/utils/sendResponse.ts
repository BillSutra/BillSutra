import type { Response } from "express";

type ResponsePayload<T = unknown> = {
  success?: boolean;
  message?: string;
  data?: T;
  [key: string]: unknown;
};

export const sendResponse = <T = unknown>(
  res: Response,
  statusCode: number,
  payload: ResponsePayload<T> = {},
) => {
  const success = payload.success ?? statusCode < 400;

  const message =
    typeof payload.message === "string" && payload.message.trim().length > 0
      ? payload.message
      : success
        ? "Request successful"
        : "Request failed";

  let data = payload.data;

  if (data === undefined) {
    const {
      success: _success,
      message: _message,
      data: _data,
      ...rest
    } = payload;

    if (Object.keys(rest).length > 0) {
      data = rest as T;
    }
  }

  const body: { success: boolean; message: string; data?: T } = {
    success,
    message,
  };

  if (data !== undefined) {
    body.data = data;
  }

  return res.status(statusCode).json(body);
};
