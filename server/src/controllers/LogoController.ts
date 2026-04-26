import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { storageProvider } from "../services/storage/storage.provider.js";
import { UPLOADS_ROOT, resolveUploadPath } from "../lib/uploadPaths.js";

/**
 * Derive the absolute file path from the stored public URL.
 *
 * Stored URL format:  /uploads/public/logos/<userId>/<filename>
 * Absolute path:      <server-root>/uploads/public/logos/<userId>/<filename>
 */
const urlToFilePath = (url: string): string => {
  const relative = url.replace(/^\//, "").replace(/^uploads\//, "");
  return resolveUploadPath(UPLOADS_ROOT, relative);
};

class LogoController {
  /**
   * GET /logo
   * Returns the current logo URL for the authenticated user.
   */
  static async get(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const profile = await prisma.businessProfile.findUnique({
      where: { user_id: userId },
      select: { logo_url: true },
    });

    return sendResponse(res, 200, {
      data: { logo_url: profile?.logo_url ?? null },
    });
  }

  /**
   * POST /logo
   * Upload a logo for the first time.
   * Returns 409 if a logo already exists — use PUT to replace it.
   */
  static async upload(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!req.file) {
      return sendResponse(res, 400, { message: "No file uploaded." });
    }

    // Guard: don't allow creating a duplicate if one already exists
    const existing = await prisma.businessProfile.findUnique({
      where: { user_id: userId },
      select: { logo_url: true },
    });

    if (existing?.logo_url) {
      return sendResponse(res, 409, {
        message: "A logo already exists. Use PUT /logo to replace it.",
      });
    }

    const { url } = await storageProvider.save(userId, req.file);

    await prisma.businessProfile.upsert({
      where: { user_id: userId },
      update: { logo_url: url },
      create: {
        user_id: userId,
        business_name: "My Business", // default; user can update via /business-profile
        logo_url: url,
      },
    });

    return sendResponse(res, 201, {
      message: "Logo uploaded successfully.",
      data: { logo_url: url },
    });
  }

  /**
   * PUT /logo
   * Replace the existing logo with a new one.
   * Deletes the old file from disk before saving the new one.
   */
  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!req.file) {
      return sendResponse(res, 400, { message: "No file uploaded." });
    }

    // Retrieve current logo so we can delete it after the new one is saved
    const profile = await prisma.businessProfile.findUnique({
      where: { user_id: userId },
      select: { logo_url: true },
    });

    // Save the new file first
    const { url } = await storageProvider.save(userId, req.file);

    // Delete the old file (if any) — do this after saving to avoid data loss on error
    if (profile?.logo_url) {
      const oldFilePath = urlToFilePath(profile.logo_url);
      await storageProvider.delete(oldFilePath);
    }

    await prisma.businessProfile.upsert({
      where: { user_id: userId },
      update: { logo_url: url },
      create: {
        user_id: userId,
        business_name: "My Business",
        logo_url: url,
      },
    });

    return sendResponse(res, 200, {
      message: "Logo updated successfully.",
      data: { logo_url: url },
    });
  }

  /**
   * DELETE /logo
   * Remove the logo: delete the file from disk and clear logo_url in the DB.
   */
  static async remove(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const profile = await prisma.businessProfile.findUnique({
      where: { user_id: userId },
      select: { logo_url: true },
    });

    if (!profile?.logo_url) {
      return sendResponse(res, 404, { message: "No logo to remove." });
    }

    // Delete the file from storage
    const filePath = urlToFilePath(profile.logo_url);
    await storageProvider.delete(filePath);

    // Clear the reference from the database
    await prisma.businessProfile.update({
      where: { user_id: userId },
      data: { logo_url: null },
    });

    return sendResponse(res, 200, { message: "Logo removed successfully." });
  }
}

export default LogoController;
