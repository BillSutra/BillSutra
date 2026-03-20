import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { z } from "zod";
import {
  authForgotSchema,
  authLoginSchema,
  authOauthSchema,
  authRegisterSchema,
  authResetSchema,
  workerLoginSchema,
} from "../validations/apiValidations.js";
import {
  buildOwnerAuthUser,
  buildWorkerAuthUser,
  createAuthBearerToken,
  ensureBusinessForUser,
} from "../lib/authSession.js";

type OAuthLoginPayload = z.infer<typeof authOauthSchema>;
type CredentialsLoginPayload = z.infer<typeof authLoginSchema>;
type CredentialsRegisterPayload = z.infer<typeof authRegisterSchema>;
type ForgotPasswordPayload = z.infer<typeof authForgotSchema>;
type ResetPasswordPayload = z.infer<typeof authResetSchema>;
type WorkerLoginPayload = z.infer<typeof workerLoginSchema>;

const serializeOwnerUser = (
  user: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>,
  authUser: AuthUser,
) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  provider: user.provider,
  image: user.image,
  is_email_verified: user.is_email_verified,
  businessId: authUser.businessId,
  role: authUser.role,
  accountType: authUser.accountType,
});

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

      const authUser = await buildOwnerAuthUser(findUser);

      return sendResponse(res, 200, {
        message: "Login successful",
        user: serializeOwnerUser(findUser, authUser),
        token: createAuthBearerToken(authUser),
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

      await ensureBusinessForUser(user.id, body.name);

      return sendResponse(res, 200, {
        message: "Registration successful",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          provider: user.provider,
          image: user.image,
          is_email_verified: user.is_email_verified,
          role: "ADMIN",
          accountType: "OWNER",
        },
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

      const authUser = await buildOwnerAuthUser(user);

      return sendResponse(res, 200, {
        message: "Login successful",
        user: serializeOwnerUser(user, authUser),
        token: createAuthBearerToken(authUser),
      });
    } catch (error) {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async workerLogin(req: Request, res: Response) {
    try {
      const body: WorkerLoginPayload = req.body;

      const worker = await prisma.worker.findUnique({
        where: { email: body.email },
      });

      if (!worker) {
        return sendResponse(res, 422, {
          message: "Invalid worker credentials",
          errors: { email: "Invalid worker credentials" },
        });
      }

      const isValidPassword = await bcrypt.compare(body.password, worker.password);

      if (!isValidPassword) {
        return sendResponse(res, 422, {
          message: "Invalid worker credentials",
          errors: { email: "Invalid worker credentials" },
        });
      }

      const authUser = await buildWorkerAuthUser(worker);

      return sendResponse(res, 200, {
        message: "Worker login successful",
        user: {
          id: worker.id,
          name: worker.name,
          email: worker.email,
          role: worker.role,
          businessId: worker.businessId,
          accountType: "WORKER",
          workerId: worker.id,
        },
        token: createAuthBearerToken(authUser),
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

