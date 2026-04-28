import type { Request, Response } from "express";
import { AuthMethod, type User } from "@prisma/client";
import jwt from "jsonwebtoken";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { z } from "zod";
import {
  authForgotSchema,
  authLoginSchema,
  authOauthSchema,
  authOtpSendSchema,
  authOtpVerifySchema,
  authRegisterSchema,
  authResendVerificationOtpSchema,
  authResetSchema,
  authVerifyEmailOtpSchema,
  passkeyAuthenticateOptionsSchema,
  passkeyAuthenticateVerifySchema,
  passkeyRegisterOptionsSchema,
  passkeyRegisterVerifySchema,
  workerLoginSchema,
} from "../validations/apiValidations.js";
import {
  buildOwnerAuthUser,
  hasSupportedAccessTokenType,
  buildWorkerAuthUser,
  ensureBusinessForUser,
  getAccessTokenExpiresAt,
  getUserSessionVersionIfAvailable,
  resolveAuthUserFromDecoded,
} from "../lib/authSession.js";
import {
  clearAuthCookies,
  issueAuthCookies,
  logResolvedTokenSource,
  refreshAuthCookies,
  resolveAccessTokenFromRequest,
  revokeAllRefreshTokensForUser,
  revokeRefreshTokenFromRequest,
} from "../lib/authCookies.js";
import {
  generateOtpCode,
  getPasskeyLabel,
  getWebAuthnConfig,
  hashSecretValue,
  maskEmail,
  normalizeEmailAddress,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  recordAuthEvent,
  sendOtpLoginEmail,
  toPublicKeyBytes,
  toStoredPublicKey,
} from "../lib/modernAuth.js";
import { sendEmail } from "../emails/index.js";
import { buildResetPasswordUrl } from "../lib/appUrls.js";
import { dispatchWelcomeEmail } from "../services/email.service.js";
import { dispatchNotification } from "../services/notification.service.js";
import {
  consumeEmailVerificationToken,
  dispatchFreshVerificationEmail,
  getEmailVerificationResendState,
  issueEmailVerificationOtp,
  resendEmailVerificationOtpForEmail,
  verifyEmailVerificationOtp,
} from "../services/emailVerification.service.js";
import { recordAuditLog } from "../services/auditLog.service.js";
import { maybeHandleSuspiciousLogin } from "../services/authSecurity.service.js";

type SerializableOwnerUser = Pick<
  User,
  "id" | "name" | "email" | "provider" | "image" | "is_email_verified"
>;

type OAuthLoginPayload = z.infer<typeof authOauthSchema>;
type CredentialsLoginPayload = z.infer<typeof authLoginSchema>;
type CredentialsRegisterPayload = z.infer<typeof authRegisterSchema>;
type VerifyEmailOtpPayload = z.infer<typeof authVerifyEmailOtpSchema>;
type ResendVerificationOtpPayload = z.infer<typeof authResendVerificationOtpSchema>;
type ForgotPasswordPayload = z.infer<typeof authForgotSchema>;
type ResetPasswordPayload = z.infer<typeof authResetSchema>;
type WorkerLoginPayload = z.infer<typeof workerLoginSchema>;
type OtpSendPayload = z.infer<typeof authOtpSendSchema>;
type OtpVerifyPayload = z.infer<typeof authOtpVerifySchema>;
type PasskeyAuthenticateOptionsPayload = z.infer<
  typeof passkeyAuthenticateOptionsSchema
>;
type PasskeyAuthenticateVerifyPayload = z.infer<
  typeof passkeyAuthenticateVerifySchema
>;
type PasskeyRegisterOptionsPayload = z.infer<
  typeof passkeyRegisterOptionsSchema
>;
type PasskeyRegisterVerifyPayload = z.infer<typeof passkeyRegisterVerifySchema>;

const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PASSKEY_TIMEOUT_MS = 60 * 1000;

const serializeOwnerUser = (
  user: SerializableOwnerUser,
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

const buildOwnerAuthResponse = async (
  req: Request,
  res: Response,
  user: SerializableOwnerUser,
  message: string,
  preferences?: {
    rememberMe?: boolean;
    reason?: string;
  },
) => {
  const authUser = await buildOwnerAuthUser(user);
  await maybeHandleSuspiciousLogin({
    req,
    userId: user.id,
    email: user.email,
    actorId: authUser.actorId,
    actorType: authUser.accountType,
  });
  const { accessToken } = await issueAuthCookies(req, res, authUser, preferences);
  const expiresAt = getAccessTokenExpiresAt();

  return {
    message,
    user: serializeOwnerUser(user, authUser),
    token: `Bearer ${accessToken}`,
    expiresAt,
  };
};

const resolveAuthUserFromAccessToken = async (token: string | null) => {
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    if (!hasSupportedAccessTokenType(decoded)) {
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
  } catch (error) {
    if (
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.NotBeforeError
    ) {
      return null;
    }

    throw error;
  }
};

const getCredentialNotFoundMessage = () =>
  "No passkey is registered for this account yet.";

const readRouteParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  provider: true,
  image: true,
  is_email_verified: true,
} as const;

const authUserWithPasswordSelect = {
  ...authUserSelect,
  password_hash: true,
} as const;

class AuthController {
  static async oauthLogin(req: Request, res: Response) {
    try {
      const body: OAuthLoginPayload = req.body;

      const provider = body.provider || "google";
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true },
      });

      const findUser = existingUser
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: body.name || "",
              provider,
              oauth_id: body.oauth_id,
              image: body.image,
              is_email_verified: true,
              email_verified_at: new Date(),
            },
            select: authUserSelect,
          })
        : await prisma.user.create({
            data: {
              name: body.name || "",
              email: body.email,
              provider,
              oauth_id: body.oauth_id,
              image: body.image,
              is_email_verified: true,
              email_verified_at: new Date(),
            },
            select: authUserSelect,
          });

      await recordAuthEvent({
        req,
        userId: findUser.id,
        method: AuthMethod.GOOGLE,
        success: true,
        actorType: "OWNER",
      });

      return sendResponse(
        res,
        200,
        await buildOwnerAuthResponse(req, res, findUser, "Login successful", {
          rememberMe: body.rememberMe,
        }),
      );
    } catch {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const body: CredentialsRegisterPayload = req.body;

      const existing = await prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true },
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
          is_email_verified: false,
          email_verified_at: null,
        },
        select: authUserSelect,
      });

      await ensureBusinessForUser(user.id, body.name);
      let otpDeliveryFailed = false;
      try {
        await issueEmailVerificationOtp(user.id, { force: true });
      } catch (error) {
        otpDeliveryFailed = true;
        console.warn("[auth] verification_otp_send_failed", {
          userId: user.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }

      return sendResponse(
        res,
        201,
        {
          message: otpDeliveryFailed
            ? "Account created. Request a verification code to continue."
            : "Account created. Verify your email to continue.",
          data: {
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              is_email_verified: false,
            },
            verification: {
              required: true,
              email: user.email,
              retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
              expiresIn: 10 * 60,
              otpDeliveryFailed,
            },
          },
        },
      );
    } catch {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async signup(req: Request, res: Response) {
    return AuthController.register(req, res);
  }

  static async verifyEmail(req: Request, res: Response) {
    try {
      const rawToken =
        typeof req.query.token === "string" ? req.query.token.trim() : "";

      if (!rawToken) {
        return sendResponse(res, 400, {
          message: "Verification token is required",
        });
      }

      const result = await consumeEmailVerificationToken(rawToken);

      if (result.status === "invalid") {
        return sendResponse(res, 400, {
          message: "Verification link is invalid",
          code: "EMAIL_VERIFICATION_INVALID",
        });
      }

      if (result.status === "expired") {
        return sendResponse(res, 410, {
          message: "Verification link expired. Request a new one.",
          code: "EMAIL_VERIFICATION_EXPIRED",
        });
      }

      void dispatchWelcomeEmail(result.user.id);

      return sendResponse(
        res,
        200,
        await buildOwnerAuthResponse(
          req,
          res,
          result.user,
          "Email verified successfully",
        ),
      );
    } catch {
      return sendResponse(res, 500, {
        message: "Unable to verify email",
      });
    }
  }

  static async resendVerification(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        return sendResponse(res, 401, { message: "Unauthorized" });
      }

      if (req.user.accountType === "WORKER") {
        return sendResponse(res, 403, {
          message: "Worker accounts do not require email verification",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          is_email_verified: true,
        },
      });

      if (!user) {
        return sendResponse(res, 404, { message: "User not found" });
      }

      if (user.is_email_verified) {
        return sendResponse(res, 200, {
          message: "Email is already verified",
        });
      }

      const resendState = await getEmailVerificationResendState(user.id);
      if (!resendState.allowed) {
        return sendResponse(res, 429, {
          message: `Please wait ${resendState.retryAfterSeconds}s before requesting another verification email.`,
          retryAfter: resendState.retryAfterSeconds,
        });
      }

      await dispatchFreshVerificationEmail(user.id);

      return sendResponse(res, 200, {
        message: "Verification email sent",
      });
    } catch {
      return sendResponse(res, 500, {
        message: "Unable to resend verification email",
      });
    }
  }

  static async resendVerificationOtp(req: Request, res: Response) {
    try {
      const body: ResendVerificationOtpPayload = req.body;
      const result = await resendEmailVerificationOtpForEmail(body.email);

      return sendResponse(res, 200, {
        message: result.message,
        data: {
          email: normalizeEmailAddress(body.email),
          retryAfter: result.retryAfter,
          expiresIn: result.expiresIn,
        },
      });
    } catch {
      return sendResponse(res, 500, {
        message: "Unable to resend verification code right now.",
      });
    }
  }

  static async verifyEmailOtp(req: Request, res: Response) {
    try {
      const body: VerifyEmailOtpPayload = req.body;
      const result = await verifyEmailVerificationOtp({
        email: body.email,
        otp: body.otp,
      });

      if (result.status === "invalid") {
        return sendResponse(res, 422, {
          message: "Invalid OTP",
          errors: { otp: "Invalid OTP" },
        });
      }

      if (result.status === "expired") {
        return sendResponse(res, 410, {
          message: "OTP expired. Please request a new one.",
          errors: { otp: "OTP expired" },
        });
      }

      if (result.status === "locked") {
        return sendResponse(res, 429, {
          message: "Too many incorrect attempts. Please request a new OTP.",
          errors: { otp: "Too many incorrect attempts" },
        });
      }

      if (result.status !== "verified" && result.status !== "already_verified") {
        return sendResponse(res, 422, {
          message: "Invalid OTP",
          errors: { otp: "Invalid OTP" },
        });
      }

      const verifiedUser = result.user;

      if (result.status === "verified") {
        void dispatchWelcomeEmail(verifiedUser.id);
      }

      await recordAuthEvent({
        req,
        userId: verifiedUser.id,
        method: AuthMethod.OTP,
        success: true,
        actorType: "OWNER",
        metadata: {
          action: "email_verification_otp",
        },
      });

      return sendResponse(
        res,
        200,
        await buildOwnerAuthResponse(
          req,
          res,
          { ...verifiedUser, is_email_verified: true },
          "Email verified successfully",
          {
            rememberMe: body.rememberMe,
            reason: "otp",
          },
        ),
      );
    } catch {
      return sendResponse(res, 500, {
        message: "Unable to verify email right now.",
      });
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const refreshed = await refreshAuthCookies(req, res);

      if (!refreshed) {
        return sendResponse(res, 401, {
          message: "Unable to refresh session",
        });
      }

      return sendResponse(res, 200, {
        message: "Session refreshed",
        data: {
          token: `Bearer ${refreshed.accessToken}`,
          source: "cookie",
          expiresAt: getAccessTokenExpiresAt(),
        },
      });
    } catch (error) {
      console.warn("[auth] refresh_failed", {
        reason: "service_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
      return sendResponse(res, 503, {
        message: "Authentication service temporarily unavailable",
        code: "AUTH_SERVICE_UNAVAILABLE",
      });
    }
  }

  static async bootstrapSecureSession(req: Request, res: Response) {
    try {
      const { headerToken, cookieToken } = resolveAccessTokenFromRequest(req);
      const authUser =
        (await resolveAuthUserFromAccessToken(headerToken)) ??
        (await resolveAuthUserFromAccessToken(cookieToken));

      logResolvedTokenSource(
        headerToken ? "header" : cookieToken ? "cookie" : "none",
        { flow: "auth.bootstrap_secure_session" },
      );

      if (!authUser) {
        clearAuthCookies(res);
        return sendResponse(res, 401, {
          message: "Unauthorized",
        });
      }

      const issued = await issueAuthCookies(req, res, authUser, {
        rememberMe:
          typeof req.body?.rememberMe === "boolean"
            ? req.body.rememberMe
            : authUser.rememberMe,
        reason: "bootstrap",
      });

      return sendResponse(res, 200, {
        message:
          "Secure cookie session bootstrapped. Legacy bearer tokens remain supported during the transition.",
        data: {
          token: `Bearer ${issued.accessToken}`,
          expiresAt: getAccessTokenExpiresAt(),
          rememberMe: issued.rememberMe,
        },
      });
    } catch (error) {
      console.warn("[auth] bootstrap_failed", {
        reason: "service_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
      return sendResponse(res, 503, {
        message: "Authentication service temporarily unavailable",
        code: "AUTH_SERVICE_UNAVAILABLE",
      });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      console.info("[auth] logout_reason=manual", {
        ownerUserId: req.user?.ownerUserId ?? null,
        accountType: req.user?.accountType ?? null,
      });
      await revokeRefreshTokenFromRequest(req);
      clearAuthCookies(res);
      if (req.user?.ownerUserId) {
        await recordAuthEvent({
          req,
          userId: req.user.ownerUserId,
          method: AuthMethod.PASSWORD,
          success: true,
          actorType: req.user.accountType,
          metadata: {
            action: "manual_logout",
            workerId: req.user.workerId ?? null,
          },
        });
      }

      return sendResponse(res, 200, {
        message: "Logged out successfully",
      });
    } catch (error) {
      console.warn("[auth] logout_reason=manual", {
        ownerUserId: req.user?.ownerUserId ?? null,
        accountType: req.user?.accountType ?? null,
        message: error instanceof Error ? error.message : String(error),
      });
      clearAuthCookies(res);
      return sendResponse(res, 200, {
        message: "Logged out successfully",
      });
    }
  }

  static async loginCheck(req: Request, res: Response) {
    try {
      const body: CredentialsLoginPayload = req.body;

      const user = await prisma.user.findUnique({
        where: { email: body.email },
        select: authUserWithPasswordSelect,
      });

      if (!user || !user.password_hash) {
        await recordAuthEvent({
          req,
          userId: user?.id,
          method: AuthMethod.PASSWORD,
          success: false,
          actorType: "OWNER",
        });

        return sendResponse(res, 422, {
          message: "Invalid credentials",
          errors: { email: "Invalid credentials" },
        });
      }

      const valid = await bcrypt.compare(body.password, user.password_hash);
      if (!valid) {
        await recordAuthEvent({
          req,
          userId: user.id,
          method: AuthMethod.PASSWORD,
          success: false,
          actorType: "OWNER",
        });

        return sendResponse(res, 422, {
          message: "Invalid credentials",
          errors: { email: "Invalid credentials" },
        });
      }

      await recordAuthEvent({
        req,
        userId: user.id,
        method: AuthMethod.PASSWORD,
        success: true,
        actorType: "OWNER",
      });

      if (!user.is_email_verified) {
        const otpResendState = await issueEmailVerificationOtp(user.id);

        return sendResponse(res, 403, {
          message: "Please verify your email first",
          code: "EMAIL_VERIFICATION_REQUIRED",
          data: {
            email: user.email,
            retryAfter: otpResendState.retryAfter,
            expiresIn: otpResendState.expiresIn,
          },
        });
      }

      return sendResponse(
        res,
        200,
        await buildOwnerAuthResponse(req, res, user, "Login successful", {
          rememberMe: body.rememberMe,
        }),
      );
    } catch {
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
        await recordAuthEvent({
          req,
          method: AuthMethod.WORKER_PASSWORD,
          success: false,
          actorType: "WORKER",
        });

        return sendResponse(res, 422, {
          message: "Invalid worker credentials",
          errors: { email: "Invalid worker credentials" },
        });
      }

      const isValidPassword = await bcrypt.compare(
        body.password,
        worker.password,
      );

      if (!isValidPassword) {
        await recordAuthEvent({
          req,
          method: AuthMethod.WORKER_PASSWORD,
          success: false,
          actorType: "WORKER",
        });

        return sendResponse(res, 422, {
          message: "Invalid worker credentials",
          errors: { email: "Invalid worker credentials" },
        });
      }

      try {
        const profileRows = await prisma.$queryRaw<Array<{ status: string }>>`
          SELECT "status"
          FROM "worker_profiles"
          WHERE "worker_id" = ${worker.id}
          LIMIT 1
        `;

        if (profileRows[0]?.status === "INACTIVE") {
          return sendResponse(res, 403, {
            message: "Worker account is inactive",
          });
        }
      } catch {
        // Migration-safe fallback: continue authentication for older schemas.
      }

      const authUser = await buildWorkerAuthUser(worker);
      const { accessToken } = await issueAuthCookies(req, res, authUser, {
        rememberMe: body.rememberMe,
      });

      try {
        await prisma.$executeRaw`
          UPDATE "worker_profiles"
          SET "last_active_at" = CURRENT_TIMESTAMP,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "worker_id" = ${worker.id}
        `;
      } catch {
        // Migration-safe fallback: login should still succeed.
      }

      await recordAuthEvent({
        req,
        userId: authUser.ownerUserId,
        method: AuthMethod.WORKER_PASSWORD,
        success: true,
        actorType: "WORKER",
        metadata: { workerId: worker.id },
      });

      void dispatchNotification({
        userId: authUser.ownerUserId,
        businessId: authUser.businessId,
        type: "worker",
        message: `${worker.name} signed in to BillSutra.`,
      });

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
        token: `Bearer ${accessToken}`,
        expiresAt: getAccessTokenExpiresAt(),
      });
    } catch {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const body: ForgotPasswordPayload = req.body;
      const email = normalizeEmailAddress(body.email);

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
      if (!user) {
        return sendResponse(res, 200, {
          message: "If an account exists for this email, a password reset link has been sent.",
        });
      }

      const token = crypto.randomBytes(24).toString("hex");
      const tokenHash = hashSecretValue(token);
      const expires = new Date(Date.now() + 1000 * 60 * 30);

      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({
          where: {
            user_id: user.id,
            used_at: null,
          },
        }),
        prisma.passwordResetToken.create({
          data: {
            user_id: user.id,
            token: tokenHash,
            expires_at: expires,
          },
        }),
      ]);

      try {
        await sendEmail("password_reset", {
          email: user.email,
          user_name: user.name,
          reset_url: buildResetPasswordUrl(token, user.email),
        }, {
          audit: {
            userId: user.id,
            metadata: {
              flow: "password_reset",
            },
          },
        });
      } catch {
        await prisma.passwordResetToken.deleteMany({
          where: {
            user_id: user.id,
            token: tokenHash,
            used_at: null,
          },
        });

        return sendResponse(res, 503, {
          message: "Unable to send the password reset email right now.",
        });
      }

      await recordAuditLog({
        req,
        userId: user.id,
        actorId: String(user.id),
        actorType: "OWNER",
        action: "auth.password_reset.requested",
        resourceType: "user",
        resourceId: String(user.id),
        metadata: {
          email,
        },
      });

      return sendResponse(res, 200, {
        message: "If an account exists for this email, a password reset link has been sent.",
      });
    } catch {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const email = normalizeEmailAddress(req.body.email);
      const { password, token } = req.body as ResetPasswordPayload;

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
        },
      });
      if (!user) {
        return sendResponse(res, 422, {
          message: "Invalid reset request",
          errors: { email: "Invalid reset request" },
        });
      }

      const reset = await prisma.passwordResetToken.findFirst({
        where: {
          user_id: user.id,
          token: hashSecretValue(token),
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
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            password_hash,
            session_version: {
              increment: 1,
            },
          },
          select: { id: true },
        }),
        prisma.passwordResetToken.update({
          where: { id: reset.id },
          data: { used_at: new Date() },
        }),
        prisma.passwordResetToken.deleteMany({
          where: {
            user_id: user.id,
            used_at: null,
            NOT: { id: reset.id },
          },
        }),
      ]);
      await revokeAllRefreshTokensForUser(user.id, "password_reset");

      await recordAuthEvent({
        req,
        userId: user.id,
        method: AuthMethod.PASSWORD,
        success: true,
        actorType: "OWNER",
        metadata: {
          action: "password_reset_completed",
        },
      });
      await recordAuditLog({
        req,
        userId: user.id,
        actorId: String(user.id),
        actorType: "OWNER",
        action: "auth.password_reset.completed",
        resourceType: "user",
        resourceId: String(user.id),
        metadata: {
          email,
        },
      });

      return sendResponse(res, 200, { message: "Password reset successful" });
    } catch {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async sendOtp(req: Request, res: Response) {
    try {
      const body: OtpSendPayload = req.body;
      const normalizedEmail = normalizeEmailAddress(body.email);
      const user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (!user) {
        return sendResponse(res, 422, {
          message: "No account found for this email",
          errors: { email: "No account found" },
        });
      }

      const latestOtp = await prisma.otpCode.findFirst({
        where: {
          user_id: user.id,
          purpose: "LOGIN",
          consumed_at: null,
        },
        orderBy: { created_at: "desc" },
      });

      if (
        latestOtp &&
        latestOtp.resend_available_at.getTime() > Date.now() &&
        latestOtp.expires_at.getTime() > Date.now()
      ) {
        const retryAfter = Math.max(
          1,
          Math.ceil(
            (latestOtp.resend_available_at.getTime() - Date.now()) / 1000,
          ),
        );

        return sendResponse(res, 429, {
          message: `Please wait ${retryAfter}s before requesting another code.`,
          retryAfter,
        });
      }

      await prisma.otpCode.deleteMany({
        where: {
          user_id: user.id,
          purpose: "LOGIN",
        },
      });

      const code = generateOtpCode();
      const otpRecord = await prisma.otpCode.create({
        data: {
          user_id: user.id,
          purpose: "LOGIN",
          channel: "EMAIL",
          code_hash: hashSecretValue(code),
          expires_at: new Date(Date.now() + OTP_TTL_MS),
          resend_available_at: new Date(Date.now() + OTP_RESEND_COOLDOWN_MS),
          max_attempts: OTP_MAX_ATTEMPTS,
        },
      });

      try {
        await sendOtpLoginEmail({
          email: user.email,
          name: user.name,
          code,
          expiresInMinutes: Math.ceil(OTP_TTL_MS / 60000),
          resendInSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
        });
      } catch (error) {
        await prisma.otpCode.delete({
          where: { id: otpRecord.id },
        });

        const message =
          error instanceof Error &&
          (error.message.includes("configuration") ||
            error.message.includes("EMAIL_USER") ||
            error.message.includes("EMAIL_PASS") ||
            error.message.includes("configured"))
            ? "Email login is not configured on the server yet."
            : "Unable to send the login code right now.";

        return sendResponse(res, 503, { message });
      }

      return sendResponse(res, 200, {
        message: `Login code sent to ${maskEmail(user.email)}.`,
        retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
        expiresIn: Math.ceil(OTP_TTL_MS / 1000),
      });
    } catch {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async verifyOtp(req: Request, res: Response) {
    try {
      const body: OtpVerifyPayload = req.body;
      const normalizedEmail = normalizeEmailAddress(body.email);
      const normalizedCode = body.code.trim();
      const user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
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
        await recordAuthEvent({
          req,
          method: AuthMethod.OTP,
          success: false,
          actorType: "OWNER",
        });

        return sendResponse(res, 422, {
          message: "Invalid or expired login code",
          errors: { code: "Invalid login code" },
        });
      }

      const otp = await prisma.otpCode.findFirst({
        where: {
          user_id: user.id,
          purpose: "LOGIN",
          consumed_at: null,
        },
        orderBy: { created_at: "desc" },
      });

      if (!otp || otp.expires_at.getTime() <= Date.now()) {
        await recordAuthEvent({
          req,
          userId: user.id,
          method: AuthMethod.OTP,
          success: false,
          actorType: "OWNER",
        });

        return sendResponse(res, 422, {
          message: "Invalid or expired login code",
          errors: { code: "Login code expired" },
        });
      }

      if (otp.attempts >= otp.max_attempts) {
        await recordAuthEvent({
          req,
          userId: user.id,
          method: AuthMethod.OTP,
          success: false,
          actorType: "OWNER",
        });

        return sendResponse(res, 429, {
          message: "Too many incorrect attempts. Please request a new code.",
        });
      }

      if (hashSecretValue(normalizedCode) !== otp.code_hash) {
        const nextAttempts = otp.attempts + 1;
        await prisma.otpCode.update({
          where: { id: otp.id },
          data: { attempts: nextAttempts },
        });

        await recordAuthEvent({
          req,
          userId: user.id,
          method: AuthMethod.OTP,
          success: false,
          actorType: "OWNER",
        });

        return sendResponse(res, 422, {
          message:
            nextAttempts >= otp.max_attempts
              ? "Too many incorrect attempts. Please request a new code."
              : `Incorrect login code. ${otp.max_attempts - nextAttempts} attempt(s) left.`,
          errors: { code: "Incorrect login code" },
        });
      }

      await prisma.$transaction([
        prisma.otpCode.update({
          where: { id: otp.id },
          data: { consumed_at: new Date() },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            is_email_verified: true,
            email_verified_at: user.is_email_verified ? undefined : new Date(),
          },
          select: { id: true },
        }),
      ]);

      if (!user.is_email_verified) {
        void dispatchWelcomeEmail(user.id);
      }

      await recordAuthEvent({
        req,
        userId: user.id,
        method: AuthMethod.OTP,
        success: true,
        actorType: "OWNER",
      });

      return sendResponse(
        res,
        200,
        await buildOwnerAuthResponse(
          req,
          res,
          { ...user, is_email_verified: true },
          "OTP verified. Login successful",
          {
            rememberMe: body.rememberMe,
            reason: "otp",
          },
        ),
      );
    } catch {
      return sendResponse(res, 500, { message: "Internal Server Error" });
    }
  }

  static async passkeyAuthenticateOptions(req: Request, res: Response) {
    try {
      const body: PasskeyAuthenticateOptionsPayload = req.body;
      const user = await prisma.user.findUnique({
        where: { email: body.email },
        select: {
          id: true,
          passkey_credentials: {
            select: {
              credential_id: true,
              transports: true,
            },
          },
        },
      });

      if (!user || user.passkey_credentials.length === 0) {
        return sendResponse(res, 404, {
          message: getCredentialNotFoundMessage(),
        });
      }

      const webAuthnConfig = getWebAuthnConfig();
      const options = await generateAuthenticationOptions({
        rpID: webAuthnConfig.rpID,
        allowCredentials: user.passkey_credentials.map((credential) => ({
          id: credential.credential_id,
          transports: credential.transports as Array<
            | "ble"
            | "cable"
            | "hybrid"
            | "internal"
            | "nfc"
            | "smart-card"
            | "usb"
          >,
        })),
        timeout: PASSKEY_TIMEOUT_MS,
        userVerification: "preferred",
      });

      await prisma.authChallenge.deleteMany({
        where: {
          user_id: user.id,
          flow: "PASSKEY_AUTHENTICATION",
          OR: [
            { expires_at: { lt: new Date() } },
            { consumed_at: { not: null } },
          ],
        },
      });

      const challenge = await prisma.authChallenge.create({
        data: {
          user_id: user.id,
          flow: "PASSKEY_AUTHENTICATION",
          challenge: options.challenge,
          expires_at: new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS),
        },
      });

      return sendResponse(res, 200, {
        data: {
          challenge_id: challenge.id,
          options,
        },
      });
    } catch {
      return sendResponse(res, 500, {
        message: "Unable to start passkey login",
      });
    }
  }

  static async passkeyAuthenticateVerify(req: Request, res: Response) {
    try {
      const body: PasskeyAuthenticateVerifyPayload = req.body;
      const user = await prisma.user.findUnique({
        where: { email: body.email },
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
        await recordAuthEvent({
          req,
          method: AuthMethod.PASSKEY,
          success: false,
          actorType: "OWNER",
        });

        return sendResponse(res, 422, {
          message: "Passkey verification failed",
        });
      }

      const [challenge, credentialRecord] = await Promise.all([
        prisma.authChallenge.findFirst({
          where: {
            id: body.challenge_id,
            user_id: user.id,
            flow: "PASSKEY_AUTHENTICATION",
            consumed_at: null,
          },
        }),
        prisma.passkeyCredential.findUnique({
          where: { credential_id: body.response.id },
        }),
      ]);

      if (
        !challenge ||
        challenge.expires_at.getTime() <= Date.now() ||
        !credentialRecord ||
        credentialRecord.user_id !== user.id
      ) {
        await recordAuthEvent({
          req,
          userId: user.id,
          method: AuthMethod.PASSKEY,
          success: false,
          actorType: "OWNER",
        });

        return sendResponse(res, 422, {
          message: "Passkey verification failed",
        });
      }

      const webAuthnConfig = getWebAuthnConfig();
      const verification = await verifyAuthenticationResponse({
        response: body.response as AuthenticationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: webAuthnConfig.origins,
        expectedRPID: webAuthnConfig.rpID,
        credential: {
          id: credentialRecord.credential_id,
          publicKey: toPublicKeyBytes(credentialRecord.public_key),
          counter: credentialRecord.counter,
          transports: credentialRecord.transports as Array<
            | "ble"
            | "cable"
            | "hybrid"
            | "internal"
            | "nfc"
            | "smart-card"
            | "usb"
          >,
        },
      });

      if (!verification.verified) {
        await recordAuthEvent({
          req,
          userId: user.id,
          method: AuthMethod.PASSKEY,
          success: false,
          actorType: "OWNER",
        });

        return sendResponse(res, 422, {
          message: "Passkey verification failed",
        });
      }

      await prisma.$transaction([
        prisma.passkeyCredential.update({
          where: { id: credentialRecord.id },
          data: {
            counter: verification.authenticationInfo.newCounter,
            device_type: verification.authenticationInfo.credentialDeviceType,
            backed_up: verification.authenticationInfo.credentialBackedUp,
            last_used_at: new Date(),
          },
        }),
        prisma.authChallenge.update({
          where: { id: challenge.id },
          data: { consumed_at: new Date() },
        }),
      ]);

      await recordAuthEvent({
        req,
        userId: user.id,
        method: AuthMethod.PASSKEY,
        success: true,
        actorType: "OWNER",
        metadata: { credentialId: credentialRecord.id },
      });

      return sendResponse(
        res,
        200,
        await buildOwnerAuthResponse(req, res, user, "Passkey login successful", {
          rememberMe: body.rememberMe,
        }),
      );
    } catch {
      return sendResponse(res, 422, {
        message: "Passkey verification failed",
      });
    }
  }

  static async listPasskeys(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        return sendResponse(res, 401, { message: "Unauthorized" });
      }

      if (req.user.accountType !== "OWNER") {
        return sendResponse(res, 403, {
          message: "Passkeys are available only for owner accounts.",
        });
      }

      const credentials = await prisma.passkeyCredential.findMany({
        where: { user_id: req.user.id },
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          label: true,
          device_type: true,
          backed_up: true,
          created_at: true,
          last_used_at: true,
        },
      });

      return sendResponse(res, 200, {
        data: credentials,
      });
    } catch {
      return sendResponse(res, 500, { message: "Unable to load passkeys" });
    }
  }

  static async passkeyRegisterOptions(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        return sendResponse(res, 401, { message: "Unauthorized" });
      }

      if (req.user.accountType !== "OWNER") {
        return sendResponse(res, 403, {
          message: "Passkeys are available only for owner accounts.",
        });
      }

      const body: PasskeyRegisterOptionsPayload = req.body;
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          passkey_credentials: {
            select: {
              credential_id: true,
              transports: true,
            },
          },
        },
      });

      if (!user) {
        return sendResponse(res, 404, { message: "User not found" });
      }

      const webAuthnConfig = getWebAuthnConfig();
      const options = await generateRegistrationOptions({
        rpName: webAuthnConfig.rpName,
        rpID: webAuthnConfig.rpID,
        userName: user.email,
        userDisplayName: user.name,
        timeout: PASSKEY_TIMEOUT_MS,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
        excludeCredentials: user.passkey_credentials.map((credential) => ({
          id: credential.credential_id,
          transports: credential.transports as Array<
            | "ble"
            | "cable"
            | "hybrid"
            | "internal"
            | "nfc"
            | "smart-card"
            | "usb"
          >,
        })),
      });

      await prisma.authChallenge.deleteMany({
        where: {
          user_id: user.id,
          flow: "PASSKEY_REGISTRATION",
          OR: [
            { expires_at: { lt: new Date() } },
            { consumed_at: { not: null } },
          ],
        },
      });

      const challenge = await prisma.authChallenge.create({
        data: {
          user_id: user.id,
          flow: "PASSKEY_REGISTRATION",
          challenge: options.challenge,
          expires_at: new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS),
        },
      });

      return sendResponse(res, 200, {
        data: {
          challenge_id: challenge.id,
          label: body.label,
          options,
        },
      });
    } catch {
      return sendResponse(res, 500, {
        message: "Unable to start passkey registration",
      });
    }
  }

  static async passkeyRegisterVerify(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        return sendResponse(res, 401, { message: "Unauthorized" });
      }

      if (req.user.accountType !== "OWNER") {
        return sendResponse(res, 403, {
          message: "Passkeys are available only for owner accounts.",
        });
      }

      const body: PasskeyRegisterVerifyPayload = req.body;
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (!user) {
        return sendResponse(res, 404, { message: "User not found" });
      }

      const challenge = await prisma.authChallenge.findFirst({
        where: {
          id: body.challenge_id,
          user_id: user.id,
          flow: "PASSKEY_REGISTRATION",
          consumed_at: null,
        },
      });

      if (!challenge || challenge.expires_at.getTime() <= Date.now()) {
        return sendResponse(res, 422, {
          message: "Passkey registration expired. Please try again.",
        });
      }

      const webAuthnConfig = getWebAuthnConfig();
      const verification = await verifyRegistrationResponse({
        response: body.response as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: webAuthnConfig.origins,
        expectedRPID: webAuthnConfig.rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return sendResponse(res, 422, {
          message: "Passkey registration could not be verified.",
        });
      }

      const credentialId = verification.registrationInfo.credential.id;
      const existing = await prisma.passkeyCredential.findUnique({
        where: { credential_id: credentialId },
        select: { id: true },
      });

      if (existing) {
        return sendResponse(res, 409, {
          message: "This passkey is already registered.",
        });
      }

      const created = await prisma.$transaction(async (tx) => {
        const credential = await tx.passkeyCredential.create({
          data: {
            user_id: user.id,
            label: getPasskeyLabel(
              typeof req.headers["user-agent"] === "string"
                ? req.headers["user-agent"]
                : undefined,
              body.label,
            ),
            credential_id: credentialId,
            public_key: toStoredPublicKey(
              verification.registrationInfo!.credential.publicKey,
            ),
            counter: verification.registrationInfo!.credential.counter,
            device_type: verification.registrationInfo!.credentialDeviceType,
            backed_up: verification.registrationInfo!.credentialBackedUp,
            transports: body.response.response.transports ?? [],
            last_used_at: new Date(),
          },
          select: {
            id: true,
            label: true,
            device_type: true,
            backed_up: true,
            created_at: true,
            last_used_at: true,
          },
        });

        await tx.authChallenge.update({
          where: { id: challenge.id },
          data: { consumed_at: new Date() },
        });

        return credential;
      });

      await recordAuthEvent({
        req,
        userId: user.id,
        method: AuthMethod.PASSWORD,
        success: true,
        actorType: "OWNER",
        metadata: {
          action: "passkey_registered",
          credentialId: created.id,
        },
      });

      return sendResponse(res, 200, {
        message: "Passkey added successfully.",
        data: created,
      });
    } catch {
      return sendResponse(res, 422, {
        message: "Passkey registration could not be verified.",
      });
    }
  }

  static async deletePasskey(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        return sendResponse(res, 401, { message: "Unauthorized" });
      }

      if (req.user.accountType !== "OWNER") {
        return sendResponse(res, 403, {
          message: "Passkeys are available only for owner accounts.",
        });
      }

      const idParam = readRouteParam(req.params.id);
      if (!idParam) {
        return sendResponse(res, 422, { message: "Passkey id is required" });
      }

      const id = Number.parseInt(idParam, 10);
      const credential = await prisma.passkeyCredential.findFirst({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!credential) {
        return sendResponse(res, 404, { message: "Passkey not found" });
      }

      await prisma.passkeyCredential.delete({
        where: { id: credential.id },
      });

      await recordAuthEvent({
        req,
        userId: req.user.id,
        method: AuthMethod.PASSWORD,
        success: true,
        actorType: "OWNER",
        metadata: {
          action: "passkey_removed",
          credentialId: credential.id,
        },
      });

      return sendResponse(res, 200, { message: "Passkey removed" });
    } catch {
      return sendResponse(res, 500, { message: "Unable to remove passkey" });
    }
  }
}

export default AuthController;
