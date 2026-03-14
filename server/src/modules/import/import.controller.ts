import type { Request, Response } from "express";
import { sendResponse } from "../../utils/sendResponse.js";
import {
  getImportTemplateCsv,
  importClients,
  importInvoiceItems,
  importInvoices,
  importProducts,
  parseImportFile,
} from "./import.service.js";

const getFileFromRequest = (req: Request, res: Response) => {
  if (!req.file) {
    sendResponse(res, 400, {
      message:
        "No file uploaded. Use multipart/form-data with file field 'file'.",
    });
    return null;
  }

  return req.file;
};

const getUserId = (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    sendResponse(res, 401, { message: "Unauthorized" });
    return null;
  }

  return userId;
};

const sendTemplateCsv = (
  req: Request,
  res: Response,
  type: "clients" | "products" | "invoices" | "invoice-items",
) => {
  const userId = getUserId(req, res);
  if (!userId) {
    return;
  }

  const template = getImportTemplateCsv(type);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${template.fileName}"`,
  );

  return res.status(200).send(template.content);
};

export const downloadClientTemplateController = (req: Request, res: Response) =>
  sendTemplateCsv(req, res, "clients");

export const downloadProductTemplateController = (
  req: Request,
  res: Response,
) => sendTemplateCsv(req, res, "products");

export const downloadInvoiceTemplateController = (
  req: Request,
  res: Response,
) => sendTemplateCsv(req, res, "invoices");

export const downloadInvoiceItemsTemplateController = (
  req: Request,
  res: Response,
) => sendTemplateCsv(req, res, "invoice-items");

export const importClientsController = async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) {
    return;
  }

  const file = getFileFromRequest(req, res);
  if (!file) {
    return;
  }

  try {
    const rows = await parseImportFile(file);
    const result = await importClients(userId, rows);

    return res.status(200).json({
      success: true,
      imported: result.imported,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return sendResponse(res, 400, { message });
  }
};

export const importProductsController = async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) {
    return;
  }

  const file = getFileFromRequest(req, res);
  if (!file) {
    return;
  }

  try {
    const rows = await parseImportFile(file);
    const result = await importProducts(userId, rows);

    return res.status(200).json({
      success: true,
      imported: result.imported,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return sendResponse(res, 400, { message });
  }
};

export const importInvoicesController = async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) {
    return;
  }

  const file = getFileFromRequest(req, res);
  if (!file) {
    return;
  }

  try {
    const rows = await parseImportFile(file);
    const result = await importInvoices(userId, rows);

    return res.status(200).json({
      success: true,
      imported: result.imported,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return sendResponse(res, 400, { message });
  }
};

export const importInvoiceItemsController = async (
  req: Request,
  res: Response,
) => {
  const userId = getUserId(req, res);
  if (!userId) {
    return;
  }

  const file = getFileFromRequest(req, res);
  if (!file) {
    return;
  }

  try {
    const rows = await parseImportFile(file);
    const result = await importInvoiceItems(userId, rows);

    return res.status(200).json({
      success: true,
      imported: result.imported,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return sendResponse(res, 400, { message });
  }
};
