import fs from "fs";
import type { NextFunction, Request, Response } from "express";
import {
  UPLOADS_ROOT,
  normalizeUploadRelativePath,
  resolveUploadPath,
} from "../lib/uploadPaths.js";

const LEGACY_UPLOAD_PREFIXES = new Set(["logos", "payment-proofs"]);

class LegacyUploadsController {
  static serve(req: Request, res: Response, next: NextFunction) {
    const relativePath = normalizeUploadRelativePath(req.path);
    const topLevelDirectory = relativePath.split("/")[0];

    if (
      !relativePath ||
      relativePath.startsWith("public/") ||
      relativePath.startsWith("private/") ||
      !LEGACY_UPLOAD_PREFIXES.has(topLevelDirectory)
    ) {
      return next();
    }

    let filePath: string;
    try {
      filePath = resolveUploadPath(UPLOADS_ROOT, relativePath);
    } catch {
      return res.status(404).json({ status: 404, message: "File not found" });
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return next();
    }

    console.warn("[uploads] legacy direct file access", {
      path: req.originalUrl,
    });

    return res.sendFile(filePath);
  }
}

export default LegacyUploadsController;
