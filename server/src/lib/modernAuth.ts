import crypto from "crypto";
import type { Request } from "express";
import { AuthMethod, Prisma } from "@prisma/client";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import prisma from "../config/db.config.js";
import { sendEmail } from "../emails/index.js";

const DEFAULT_RP_NAME = "Billsutra";
const DEFAULT_ORIGIN = "http://localhost:3000";
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 3;

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

export const normalizeEmailAddress = (value: string) => value.trim().toLowerCase();

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

let supportedAuthMethodsPromise: Promise<Set<string> | null> | null = null;

const loadSupportedAuthMethods = async () => {
  try {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>(
      Prisma.sql`SELECT unnest(enum_range(NULL::"AuthMethod"))::text AS value`,
    );

    return new Set(
      rows
        .map((row) => row.value?.trim())
        .filter((value): value is string => Boolean(value)),
    );
  } catch {
    return null;
  }
};

const isAuthMethodSupportedByDatabase = async (method: AuthMethod) => {
  if (!supportedAuthMethodsPromise) {
    supportedAuthMethodsPromise = loadSupportedAuthMethods();
  }

  const supportedMethods = await supportedAuthMethodsPromise;
  if (!supportedMethods) {
    return true;
  }

  return supportedMethods.has(String(method));
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
    const isSupported = await isAuthMethodSupportedByDatabase(method);
    if (!isSupported) {
      return;
    }

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
  expiresInMinutes,
  resendInSeconds,
}: {
  email: string;
  name?: string | null;
  code: string;
  expiresInMinutes: number;
  resendInSeconds: number;
}) => {
  await sendEmail("otp_login", {
    email,
    user_name: name?.trim() || "there",
    code,
    expires_in_minutes: expiresInMinutes,
    resend_in_seconds: resendInSeconds,
  });
};
