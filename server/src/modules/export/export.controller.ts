import type { Request, Response } from "express";
import { sendResponse } from "../../utils/sendResponse.js";
import { executeExport, previewExport } from "./export.service.js";
import { recordAuditLog } from "../../services/auditLog.service.js";

class ExportController {
  static async preview(req: Request, res: Response) {
    const authUser = req.user;
    if (!authUser?.id) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    try {
      const result = await previewExport(
        {
          id: authUser.id,
        },
        {
          resource: req.params.resource as "products" | "customers" | "invoices",
          scope: req.body.scope,
          fields: req.body.fields,
          selected_ids: req.body.selected_ids,
          filters: req.body.filters,
        },
      );

      return sendResponse(res, 200, { data: result });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to preview export.";
      return sendResponse(res, 400, { message });
    }
  }

  static async run(req: Request, res: Response) {
    const authUser = req.user;
    if (!authUser?.id) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    try {
      const result = await executeExport(
        {
          id: authUser.id,
          email: authUser.email,
          actorId: authUser.actorId,
        },
        {
          resource: req.params.resource as "products" | "customers" | "invoices",
          format: req.body.format,
          scope: req.body.scope,
          delivery: req.body.delivery,
          email: req.body.email,
          fields: req.body.fields,
          selected_ids: req.body.selected_ids,
          filters: req.body.filters,
        },
      );
      await recordAuditLog({
        req,
        userId: authUser.ownerUserId,
        actorId: authUser.actorId,
        actorType: authUser.accountType,
        action: "export.run",
        resourceType: "export",
        resourceId: req.params.resource,
        status: "success",
        metadata: {
          format: req.body.format,
          scope: req.body.scope,
          delivery: req.body.delivery,
          selectedCount: Array.isArray(req.body.selected_ids)
            ? req.body.selected_ids.length
            : 0,
        },
      });

      if (result.delivery === "email") {
        return sendResponse(res, 200, {
          message: `Export sent to ${result.email}`,
          data: {
            delivery: result.delivery,
            exportedCount: result.exportedCount,
            fileName: result.fileName,
            email: result.email,
          },
        });
      }

      res.setHeader("Content-Type", result.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );
      return res.status(200).send(result.content);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to export data.";
      return sendResponse(res, 400, { message });
    }
  }
}

export default ExportController;
