import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import bcrypt from "bcryptjs";
import type { z } from "zod";
import {
  userPasswordUpdateSchema,
  userProfileUpdateSchema,
} from "../validations/apiValidations.js";
import {
  ensureBusinessForUser,
  findBusinessByOwnerIdIfAvailable,
} from "../lib/authSession.js";
import { sendEmail } from "../emails/index.js";
import {
  LEGACY_LOGOS_ROOT,
  LEGACY_PAYMENT_PROOFS_ROOT,
  PRIVATE_PAYMENT_PROOFS_ROOT,
  PUBLIC_LOGOS_ROOT,
} from "../lib/uploadPaths.js";
import { deleteUploadedFilesByOwnerId } from "../services/uploadedFiles.service.js";
import {
  clearAuthCookies,
  revokeAllRefreshTokensForUser,
} from "../lib/authCookies.js";
import { recordAuditLog } from "../services/auditLog.service.js";

type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;
type UserPasswordUpdateInput = z.infer<typeof userPasswordUpdateSchema>;

const removeUserUploads = (userId: number) => {
  [
    PUBLIC_LOGOS_ROOT,
    LEGACY_LOGOS_ROOT,
    PRIVATE_PAYMENT_PROOFS_ROOT,
    LEGACY_PAYMENT_PROOFS_ROOT,
  ].forEach((uploadsRoot) => {
    const userUploadsDir = path.join(uploadsRoot, String(userId));
    fs.rmSync(userUploadsDir, { recursive: true, force: true });
  });
};

class UsersController {
  static async me(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (req.user?.accountType === "WORKER" && req.user.workerId) {
      const worker = await prisma.worker.findUnique({
        where: { id: req.user.workerId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          businessId: true,
        },
      });

      if (!worker) {
        return sendResponse(res, 404, { message: "Worker not found" });
      }

      return sendResponse(res, 200, {
        data: {
          id: worker.id,
          name: worker.name,
          email: worker.email,
          provider: "worker",
          is_email_verified: true,
          role: worker.role,
          businessId: worker.businessId,
          account_type: "WORKER",
          worker_id: worker.id,
        },
      });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        provider: true,
        image: true,
        is_email_verified: true,
      },
    });

    if (!user) {
      return sendResponse(res, 404, { message: "User not found" });
    }

    return sendResponse(res, 200, {
      data: {
        ...user,
        role: req.user?.role ?? "ADMIN",
        businessId: req.user?.businessId,
        account_type: "OWNER",
      },
    });
  }

  static async updateProfile(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: UserProfileUpdateInput = req.body;
    const { name, email } = body;

    if (!name && !email) {
      return sendResponse(res, 422, {
        message: "No changes provided",
        errors: { name: "Provide a name or email" },
      });
    }

    if (req.user?.accountType === "WORKER" && req.user.workerId) {
      if (email) {
        const existingWorker = await prisma.worker.findFirst({
          where: { email, NOT: { id: req.user.workerId } },
        });
        if (existingWorker) {
          return sendResponse(res, 422, {
            message: "Email already in use",
            errors: { email: "Email already in use" },
          });
        }
      }

      const updatedWorker = await prisma.worker.update({
        where: { id: req.user.workerId },
        data: {
          name: name ?? undefined,
          email: email ?? undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          businessId: true,
        },
      });

      return sendResponse(res, 200, {
        message: "Profile updated",
        data: {
          id: updatedWorker.id,
          name: updatedWorker.name,
          email: updatedWorker.email,
          provider: "worker",
          is_email_verified: true,
          role: updatedWorker.role,
          businessId: updatedWorker.businessId,
          account_type: "WORKER",
          worker_id: updatedWorker.id,
        },
      });
    }

    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (existing) {
        return sendResponse(res, 422, {
          message: "Email already in use",
          errors: { email: "Email already in use" },
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name ?? undefined,
        email: email ?? undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        provider: true,
        image: true,
        is_email_verified: true,
      },
    });

    return sendResponse(res, 200, {
      message: "Profile updated",
      data: {
        ...updated,
        role: req.user?.role ?? "ADMIN",
        businessId: req.user?.businessId,
        account_type: "OWNER",
      },
    });
  }

  static async updatePassword(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: UserPasswordUpdateInput = req.body;
    const { current_password, password } = body;

    if (req.user?.accountType === "WORKER" && req.user.workerId) {
      const worker = await prisma.worker.findUnique({
        where: { id: req.user.workerId },
        select: { password: true },
      });

      if (!worker) {
        return sendResponse(res, 404, { message: "Worker not found" });
      }

      const valid = await bcrypt.compare(current_password, worker.password);
      if (!valid) {
        return sendResponse(res, 422, {
          message: "Current password is incorrect",
          errors: { current_password: "Incorrect password" },
        });
      }

      const password_hash = await bcrypt.hash(password, 12);
      await prisma.worker.update({
        where: { id: req.user.workerId },
        data: { password: password_hash },
      });

      return sendResponse(res, 200, { message: "Password updated" });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { password_hash: true, provider: true },
    });

    if (!user) {
      return sendResponse(res, 404, { message: "User not found" });
    }

    if (user.provider === "google") {
      return sendResponse(res, 400, {
        message: "Password updates are managed by Google for this account",
      });
    }

    if (!user.password_hash) {
      return sendResponse(res, 400, {
        message: "Password updates are not available for this account",
      });
    }

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return sendResponse(res, 422, {
        message: "Current password is incorrect",
        errors: { current_password: "Incorrect password" },
      });
    }

    const password_hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password_hash,
        session_version: {
          increment: 1,
        },
      },
    });
    await revokeAllRefreshTokensForUser(userId, "password_change");
    clearAuthCookies(res);
    await recordAuditLog({
      req,
      userId,
      actorId: req.user?.actorId ?? String(userId),
      actorType: req.user?.accountType ?? "OWNER",
      action: "auth.password_change",
      resourceType: "user",
      resourceId: String(userId),
      status: "success",
    });

    return sendResponse(res, 200, {
      message: "Password updated",
      data: {
        reauthRequired: true,
      },
    });
  }

  static async deleteData(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (req.user?.accountType === "WORKER") {
      return sendResponse(res, 403, {
        message: "Only the business admin can delete business data",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    const business = await findBusinessByOwnerIdIfAvailable(userId);

    await prisma.passwordResetToken.deleteMany({ where: { user_id: userId } });
    await prisma.emailVerificationToken.deleteMany({ where: { user_id: userId } });
    await prisma.recurringInvoiceTemplate.deleteMany({
      where: { user_id: userId },
    });
    await prisma.invoice.deleteMany({ where: { user_id: userId } });
    await prisma.sale.deleteMany({ where: { user_id: userId } });
    await prisma.purchase.deleteMany({ where: { user_id: userId } });
    await prisma.warehouse.deleteMany({ where: { user_id: userId } });
    await prisma.product.deleteMany({ where: { user_id: userId } });
    await prisma.category.deleteMany({ where: { user_id: userId } });
    await prisma.supplier.deleteMany({ where: { user_id: userId } });
    await prisma.customer.deleteMany({ where: { user_id: userId } });
    await prisma.businessProfile.deleteMany({ where: { user_id: userId } });
    await deleteUploadedFilesByOwnerId(userId);
    await prisma.userTemplate.deleteMany({ where: { user_id: userId } });
    await prisma.userSavedTemplate.deleteMany({ where: { user_id: userId } });

    if (business) {
      await prisma.worker.deleteMany({ where: { businessId: business.id } });
      await prisma.business.delete({ where: { id: business.id } });
    }

    await ensureBusinessForUser(userId);
    removeUserUploads(userId);

    if (user?.email) {
      try {
        await sendEmail("delete_data_confirmation", {
          email: user.email,
          user_name: user.name,
        });
      } catch {
        // Data deletion should not be blocked by a confirmation email failure.
      }
    }

    return sendResponse(res, 200, { message: "User data deleted" });
  }

  static async deleteAccount(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (req.user?.accountType === "WORKER") {
      return sendResponse(res, 403, {
        message: "Only the business admin can delete the business account",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    const business = await findBusinessByOwnerIdIfAvailable(userId);

    if (business) {
      await prisma.worker.deleteMany({ where: { businessId: business.id } });
      await prisma.business.delete({ where: { id: business.id } });
    }

    const deleted = await prisma.user.deleteMany({
      where: { id: userId },
    });

    if (!deleted.count) {
      return sendResponse(res, 404, { message: "User not found" });
    }

    removeUserUploads(userId);

    if (user?.email) {
      try {
        await sendEmail("delete_account_confirmation", {
          email: user.email,
          user_name: user.name,
        });
      } catch {
        // Account deletion should not be blocked by a confirmation email failure.
      }
    }

    return sendResponse(res, 200, { message: "Account deleted" });
  }
}

export default UsersController;
