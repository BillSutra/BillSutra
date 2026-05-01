import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import {
  listExtraEntries,
  getExtraEntryById,
  createExtraEntry,
  updateExtraEntry,
  deleteExtraEntry,
} from "../services/extraEntry.service.js";
import type { EntryType } from "@prisma/client";
import { emitDashboardUpdate } from "../services/dashboardRealtime.js";

const readRouteParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parsePagination = (query: Record<string, unknown>) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  return { page, limit };
};

const parseDateRange = (query: Record<string, unknown>) => {
  const from = query.from ? new Date(query.from as string) : undefined;
  const to = query.to ? new Date(query.to as string) : undefined;
  if (from && Number.isNaN(from.getTime())) return { from: undefined, to: undefined };
  if (to && Number.isNaN(to.getTime())) return { from: undefined, to: undefined };
  return { from, to };
};

const index = async (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: number }).userId!;
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const { from, to } = parseDateRange(req.query as Record<string, unknown>);
  const type = req.query.type as EntryType | undefined;

  const result = await listExtraEntries({ userId, from, to, type, page, limit });
  return sendResponse(res, 200, { data: result });
};

const show = async (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: number }).userId!;
  const id = readRouteParam(req.params.id) ?? "";

  const entry = await getExtraEntryById({ id, userId });
  if (!entry) return sendResponse(res, 404, { message: "Entry not found" });

  return sendResponse(res, 200, { data: entry });
};

const store = async (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: number }).userId!;
  const { title, amount, type, date, notes } = req.body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return sendResponse(res, 400, { message: "Title is required" });
  }
  if (amount === undefined || amount === null || Number(amount) <= 0) {
    return sendResponse(res, 400, { message: "Amount must be a positive number" });
  }
  if (!type || !["INCOME", "EXPENSE", "LOSS", "INVESTMENT"].includes(type)) {
    return sendResponse(res, 400, { message: "Type must be INCOME, EXPENSE, LOSS, or INVESTMENT" });
  }
  if (!date || Number.isNaN(new Date(date).getTime())) {
    return sendResponse(res, 400, { message: "Valid date is required" });
  }

  const entry = await createExtraEntry({
    userId,
    title: title.trim(),
    amount: Number(amount),
    type,
    date: new Date(date),
    notes: notes?.trim() || null,
  });

  emitDashboardUpdate({ userId, source: "extra-entry:create" });

  return sendResponse(res, 201, { data: entry });
};

const update = async (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: number }).userId!;
  const id = readRouteParam(req.params.id) ?? "";
  const { title, amount, type, date, notes } = req.body;

  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    return sendResponse(res, 400, { message: "Title cannot be empty" });
  }
  if (amount !== undefined && (Number(amount) <= 0 || Number.isNaN(Number(amount)))) {
    return sendResponse(res, 400, { message: "Amount must be a positive number" });
  }
  if (type !== undefined && !["INCOME", "EXPENSE", "LOSS", "INVESTMENT"].includes(type)) {
    return sendResponse(res, 400, { message: "Type must be INCOME, EXPENSE, LOSS, or INVESTMENT" });
  }
  if (date !== undefined && Number.isNaN(new Date(date).getTime())) {
    return sendResponse(res, 400, { message: "Invalid date" });
  }

  const entry = await updateExtraEntry({
    id,
    userId,
    title: title?.trim(),
    amount: amount !== undefined ? Number(amount) : undefined,
    type,
    date: date ? new Date(date) : undefined,
    notes: notes === undefined ? undefined : notes?.trim() || null,
  });

  if (!entry) return sendResponse(res, 404, { message: "Entry not found" });

  emitDashboardUpdate({ userId, source: "extra-entry:update" });

  return sendResponse(res, 200, { data: entry });
};

const destroy = async (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: number }).userId!;
  const id = readRouteParam(req.params.id) ?? "";

  const deleted = await deleteExtraEntry({ id, userId });
  if (!deleted) return sendResponse(res, 404, { message: "Entry not found" });

  emitDashboardUpdate({ userId, source: "extra-entry:delete" });

  return sendResponse(res, 200, { data: { deleted: true } });
};

const ExtraEntryController = { index, show, store, update, destroy };
export default ExtraEntryController;
