import fs from "fs";
import jwt from "jsonwebtoken";
import path from "path";
import type { Request, Response } from "express";
import { findUploadedFileById } from "../services/uploadedFiles.service.js";
import {
  LEGACY_PAYMENT_PROOFS_ROOT,
  PRIVATE_EXPORTS_ROOT,
  PRIVATE_PAYMENT_PROOFS_ROOT,
  isPathInsideRoot,
} from "../lib/uploadPaths.js";
import {
  logResolvedTokenSource,
  parseCookies,
  resolveAccessTokenFromRequest,
} from "../lib/authCookies.js";
import {
  getUserSessionVersionIfAvailable,
  resolveAuthUserFromDecoded,
} from "../lib/authSession.js";

const ADMIN_AUTH_COOKIE_NAME = "bill_sutra_admin_session";

type SecureFileActor =
  | {
      kind: "owner";
      ownerUserId: number;
      source: "header" | "cookie";
    }
  | {
      kind: "admin";
      adminId: string;
      email: string;
      source: "header" | "cookie";
    };

const verifyOwnerToken = async (token: string) => {
  let decoded: string | jwt.JwtPayload;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  } catch {
    return null;
  }

  const authUser = await resolveAuthUserFromDecoded(decoded);
  if (!authUser) {
    return null;
  }

  const latestSessionVersion = await getUserSessionVersionIfAvailable(
    authUser.ownerUserId,
  );
  if (
    latestSessionVersion !== null &&
    latestSessionVersion !== authUser.sessionVersion
  ) {
    return null;
  }

  return authUser;
};

const verifyAdminToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    if (!decoded || typeof decoded === "string") {
      return null;
    }

    const payload = decoded as Record<string, unknown>;
    const adminId =
      typeof payload.adminId === "string" ? payload.adminId.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const role =
      payload.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : undefined;

    if (!adminId || !email || role !== "SUPER_ADMIN") {
      return null;
    }

    return {
      adminId,
      email,
    };
  } catch {
    return null;
  }
};

const resolveSecureFileActor = async (
  req: Request,
): Promise<SecureFileActor | null> => {
  const { headerToken, cookieToken } = resolveAccessTokenFromRequest(req);
  const adminCookieToken =
    parseCookies(req.headers.cookie).get(ADMIN_AUTH_COOKIE_NAME) ?? null;

  if (headerToken) {
    const ownerUser = await verifyOwnerToken(headerToken);
    if (ownerUser) {
      logResolvedTokenSource("header", {
        path: req.path,
        secureFile: true,
        accountType: ownerUser.accountType,
        role: ownerUser.role,
      });

      return {
        kind: "owner",
        ownerUserId: ownerUser.ownerUserId,
        source: "header",
      };
    }

    const admin = verifyAdminToken(headerToken);
    if (admin) {
      console.info("[uploads] secure file token source", {
        source: "header",
        admin: true,
      });

      return {
        kind: "admin",
        adminId: admin.adminId,
        email: admin.email,
        source: "header",
      };
    }
  }

  if (cookieToken) {
    const ownerUser = await verifyOwnerToken(cookieToken);
    if (ownerUser) {
      logResolvedTokenSource("cookie", {
        path: req.path,
        secureFile: true,
        accountType: ownerUser.accountType,
        role: ownerUser.role,
      });

      return {
        kind: "owner",
        ownerUserId: ownerUser.ownerUserId,
        source: "cookie",
      };
    }
  }

  if (adminCookieToken) {
    const admin = verifyAdminToken(adminCookieToken);
    if (admin) {
      console.info("[uploads] secure file token source", {
        source: "cookie",
        admin: true,
      });

      return {
        kind: "admin",
        adminId: admin.adminId,
        email: admin.email,
        source: "cookie",
      };
    }
  }

  return null;
};

class SecureFilesController {
  static async show(req: Request, res: Response) {
    const actor = await resolveSecureFileActor(req);
    if (!actor) {
      return res.status(401).json({ status: 401, message: "Unauthorized" });
    }

    const fileId = req.params.id?.trim();
    if (!fileId) {
      return res.status(400).json({ status: 400, message: "File id is required" });
    }

    const fileRecord = await findUploadedFileById(fileId);
    if (!fileRecord) {
      return res.status(404).json({ status: 404, message: "File not found" });
    }

    if (actor.kind === "owner" && fileRecord.user_id !== actor.ownerUserId) {
      return res.status(403).json({ status: 403, message: "Forbidden" });
    }

    const absoluteFilePath = path.resolve(fileRecord.file_path);
    const isAllowedPath =
      isPathInsideRoot(PRIVATE_EXPORTS_ROOT, absoluteFilePath) ||
      isPathInsideRoot(PRIVATE_PAYMENT_PROOFS_ROOT, absoluteFilePath) ||
      isPathInsideRoot(LEGACY_PAYMENT_PROOFS_ROOT, absoluteFilePath);

    if (!isAllowedPath || !fs.existsSync(absoluteFilePath)) {
      return res.status(404).json({ status: 404, message: "File not found" });
    }

    if (fileRecord.mime_type) {
      res.type(fileRecord.mime_type);
    }

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${path.basename(fileRecord.file_name).replace(/"/g, "")}"`,
    );
    res.setHeader("Cache-Control", "private, max-age=60");

    return res.sendFile(absoluteFilePath);
  }
}

export default SecureFilesController;
