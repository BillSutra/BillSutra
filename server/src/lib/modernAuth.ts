import crypto from "crypto";
import type { Request } from "express";
import { AuthMethod, Prisma } from "@prisma/client";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import prisma from "../config/db.config.js";
import { sendMail } from "../utils/mailer.js";

const DEFAULT_RP_NAME = "Billsutra";
const DEFAULT_ORIGIN = "http://localhost:3000";
const OTP_LENGTH = 6;

const splitConfigList = (value?: string | null) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseOrigin = (origin: string) => {
  try {
    return new URL(origin);
  } catch {
    return new URL(DEFAULT_ORIGIN);
  }
};

export const getWebAuthnConfig = () => {
  const origins = splitConfigList(
    process.env.WEBAUTHN_ORIGIN ??
      process.env.FRONTEND_URL ??
      process.env.APP_URL ??
      process.env.CLIENT_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      DEFAULT_ORIGIN,
  );

  const normalizedOrigins = origins.length > 0 ? origins : [DEFAULT_ORIGIN];
  const primaryOrigin = parseOrigin(normalizedOrigins[0]);

  return {
    rpName: process.env.WEBAUTHN_RP_NAME?.trim() || DEFAULT_RP_NAME,
    rpID: process.env.WEBAUTHN_RP_ID?.trim() || primaryOrigin.hostname,
    origins: normalizedOrigins,
  };
};

export const generateOtpCode = () =>
  Array.from(crypto.randomBytes(OTP_LENGTH))
    .map((byte) => String(byte % 10))
    .join("")
    .slice(0, OTP_LENGTH);

export const hashSecretValue = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

export const maskEmail = (email: string) => {
  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}***@${domainPart}`;
  }

  return `${localPart.slice(0, 2)}***@${domainPart}`;
};

export const getPasskeyLabel = (
  userAgentValue: string | undefined,
  providedLabel?: string | null,
) => {
  const trimmedLabel = providedLabel?.trim();
  if (trimmedLabel) {
    return trimmedLabel.slice(0, 191);
  }

  const userAgent = (userAgentValue ?? "").toLowerCase();
  const platform = userAgent.includes("android")
    ? "Android"
    : userAgent.includes("iphone") || userAgent.includes("ipad")
      ? "iPhone"
      : userAgent.includes("windows")
        ? "Windows"
        : userAgent.includes("mac os")
          ? "Mac"
          : userAgent.includes("linux")
            ? "Linux"
            : "This device";

  return `Passkey on ${platform}`;
};

export const toStoredPublicKey = (publicKey: Uint8Array) =>
  isoBase64URL.fromBuffer(new Uint8Array(publicKey));

export const toPublicKeyBytes = (value: string) =>
  isoBase64URL.toBuffer(value);

export const getClientIpAddress = (req: Request) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return forwardedFor[0];
  }

  return req.ip || null;
};

export const recordAuthEvent = async ({
  req,
  userId,
  method,
  success,
  actorType,
  metadata,
}: {
  req: Request;
  userId?: number | null;
  method: AuthMethod;
  success: boolean;
  actorType: string;
  metadata?: Record<string, unknown>;
}) => {
  try {
    await prisma.authEvent.create({
      data: {
        user_id: userId ?? undefined,
        actor_type: actorType,
        method,
        success,
        ip_address: getClientIpAddress(req) ?? undefined,
        user_agent:
          typeof req.headers["user-agent"] === "string"
            ? req.headers["user-agent"].slice(0, 512)
            : undefined,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Auth logging should never block a login flow.
  }
};

export const sendOtpLoginEmail = async ({
  email,
  name,
  code,
}: {
  email: string;
  name?: string | null;
  code: string;
}) => {
  const recipientName = name?.trim() || "there";

  await sendMail({
    to: email,
    subject: "Your Billsutra login code",
    text: `Hi ${recipientName}, your Billsutra login code is ${code}. It expires in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f1b16; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">Your Billsutra login code</h2>
        <p>Hi ${recipientName},</p>
        <p>Use this one-time code to sign in to Billsutra:</p>
        <div style="display: inline-block; margin: 12px 0; padding: 14px 18px; border-radius: 12px; background: #fff7ed; border: 1px solid #fed7aa; font-size: 28px; font-weight: 700; letter-spacing: 0.35em;">
          ${code}
        </div>
        <p>This code expires in 5 minutes and can only be used once.</p>
        <p>If you did not request this login code, you can ignore this email.</p>
      </div>
    `,
  });
};
