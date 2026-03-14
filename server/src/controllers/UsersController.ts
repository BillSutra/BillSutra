import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import bcrypt from "bcryptjs";
import type { z } from "zod";
import {
  userPasswordUpdateSchema,
  userProfileUpdateSchema,
} from "../validations/apiValidations.js";

type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;
type UserPasswordUpdateInput = z.infer<typeof userPasswordUpdateSchema>;

class UsersController {
  static async me(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
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

    return sendResponse(res, 200, { data: user });
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
      data: updated,
    });
  }

  static async updatePassword(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: UserPasswordUpdateInput = req.body;
    const { current_password, password } = body;

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
      data: { password_hash },
    });

    return sendResponse(res, 200, { message: "Password updated" });
  }
}

export default UsersController;
