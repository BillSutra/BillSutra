import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { z } from "zod";
import {
  authForgotSchema,
  authLoginSchema,
  authOauthSchema,
  authRegisterSchema,
  authResetSchema,
} from "../validations/apiValidations.js";

const signToken = (payload: { id: number; email: string; name: string }) => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: "365d",
  });
};

type OAuthLoginPayload = z.infer<typeof authOauthSchema>;
type CredentialsLoginPayload = z.infer<typeof authLoginSchema>;
type CredentialsRegisterPayload = z.infer<typeof authRegisterSchema>;
type ForgotPasswordPayload = z.infer<typeof authForgotSchema>;
type ResetPasswordPayload = z.infer<typeof authResetSchema>;

class AuthController {
  static async oauthLogin(req: Request, res: Response) {
    try {
      const body: OAuthLoginPayload = req.body;

      const provider = body.provider || "google";
      const findUser = await prisma.user.upsert({
        where: { email: body.email },
        update: {
          name: body.name || "",
          provider,
          oauth_id: body.oauth_id,
          image: body.image,
          is_email_verified: true,
        },
        create: {
          name: body.name || "",
          email: body.email,
          provider,
          oauth_id: body.oauth_id,
          image: body.image,
          is_email_verified: true,
        },
      });

      const token = signToken({
        id: findUser.id,
        name: findUser.name,
        email: findUser.email,
      });

      return sendResponse(res, 200, {
        message: "Login successful",
        user: findUser,
        token: `Bearer ${token}`,
      });
    } catch (error) {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const body: CredentialsRegisterPayload = req.body;

      const existing = await prisma.user.findUnique({
        where: { email: body.email },
      });
      if (existing) {
        return sendResponse(res, 422, {
          message: "Email already registered",
          errors: { email: "Email already registered" },
        });
      }

      const password_hash = await bcrypt.hash(body.password, 12);
      const user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          password_hash,
          provider: "credentials",
        },
      });

      return sendResponse(res, 200, {
        message: "Registration successful",
        user,
      });
    } catch (error) {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async loginCheck(req: Request, res: Response) {
    try {
      const body: CredentialsLoginPayload = req.body;

      const user = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (!user || !user.password_hash) {
        return sendResponse(res, 422, {
          message: "Invalid credentials",
          errors: { email: "Invalid credentials" },
        });
      }

      const valid = await bcrypt.compare(body.password, user.password_hash);
      if (!valid) {
        return sendResponse(res, 422, {
          message: "Invalid credentials",
          errors: { email: "Invalid credentials" },
        });
      }

      const token = signToken({
        id: user.id,
        email: user.email,
        name: user.name,
      });

      return sendResponse(res, 200, {
        message: "Login successful",
        user,
        token: `Bearer ${token}`,
      });
    } catch (error) {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const body: ForgotPasswordPayload = req.body;
      const { email } = body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return sendResponse(res, 422, {
          message: "No account found for this email",
          errors: { email: "No account found" },
        });
      }

      const token = crypto.randomBytes(24).toString("hex");
      const expires = new Date(Date.now() + 1000 * 60 * 30);

      await prisma.passwordResetToken.create({
        data: {
          user_id: user.id,
          token,
          expires_at: expires,
        },
      });

      return sendResponse(res, 200, {
        message: "Reset link generated",
        token,
      });
    } catch (error) {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { email, password, token } = req.body as ResetPasswordPayload;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return sendResponse(res, 422, {
          message: "Invalid reset request",
          errors: { email: "Invalid reset request" },
        });
      }

      const reset = await prisma.passwordResetToken.findFirst({
        where: {
          user_id: user.id,
          token,
          used_at: null,
          expires_at: { gt: new Date() },
        },
      });

      if (!reset) {
        return sendResponse(res, 422, {
          message: "Invalid or expired reset token",
          errors: { token: "Invalid token" },
        });
      }

      const password_hash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password_hash },
      });
      await prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { used_at: new Date() },
      });

      return sendResponse(res, 200, { message: "Password reset successful" });
    } catch (error) {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }
}

export default AuthController;

