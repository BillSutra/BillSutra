import crypto from "node:crypto";
import prisma from "../config/db.config.js";
import { sendEmail } from "../emails/index.js";
import { buildVerifyEmailUrl } from "../lib/appUrls.js";
import {
  generateOtpCode,
  hashSecretValue,
  maskEmail,
  normalizeEmailAddress,
} from "../lib/modernAuth.js";
import { enqueueEmailVerificationEmail } from "../queues/jobs/email.jobs.js";
import type { AppQueueContextInput } from "../queues/types.js";

const EMAIL_VERIFICATION_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const EMAIL_VERIFICATION_OTP_TTL_MS = 10 * 60 * 1000;
export const EMAIL_VERIFICATION_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const EMAIL_VERIFICATION_OTP_MAX_ATTEMPTS = 5;

const getUserRecipient = async (userId: number) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      deleted_at: true,
      is_email_verified: true,
    },
  });

export const getEmailVerificationExpiryDate = () =>
  new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

export const createEmailVerificationToken = async (userId: number) => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSecretValue(rawToken);

  await prisma.emailVerificationToken.deleteMany({
    where: { user_id: userId },
  });

  await prisma.emailVerificationToken.create({
    data: {
      user_id: userId,
      token_hash: tokenHash,
      expires_at: getEmailVerificationExpiryDate(),
    },
  });

  return {
    rawToken,
    expiresInMinutes: Math.ceil(EMAIL_VERIFICATION_TTL_MS / 60000),
  };
};

export const sendVerificationEmail = async ({
  userId,
  rawToken,
}: {
  userId: number;
  rawToken: string;
}) => {
  const user = await getUserRecipient(userId);
  if (
    !user ||
    user.deleted_at ||
    user.is_email_verified ||
    !user.email.trim()
  ) {
    return null;
  }

  return sendEmail("verify_email", {
    email: user.email,
    user_name: user.name,
    verify_url: buildVerifyEmailUrl(rawToken),
    expires_in_minutes: Math.ceil(EMAIL_VERIFICATION_TTL_MS / 60000),
  }, {
    audit: {
      userId: user.id,
      metadata: {
        flow: "verify_email",
      },
    },
  });
};

export const sendFreshVerificationEmail = async ({
  userId,
  reason,
}: {
  userId: number;
  reason?: "signup" | "manual";
}) => {
  const token = await createEmailVerificationToken(userId);
  await sendVerificationEmail({
    userId,
    rawToken: token.rawToken,
  });

  return {
    ...token,
    reason: reason ?? "manual",
  };
};

export const dispatchVerificationEmail = async ({
  userId,
  reason,
  context,
  fallbackRawToken,
}: {
  userId: number;
  reason?: "signup" | "manual";
  context?: AppQueueContextInput;
  fallbackRawToken?: string;
}) => {
  let queued:
    | ({ queued: boolean } & Record<string, unknown>)
    | { queued: false; reason: "enqueue_error" };

  try {
    queued = await enqueueEmailVerificationEmail({
      userId,
      reason,
      context,
    });
  } catch (error) {
    console.warn("[email] verification queue enqueue attempt failed", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    queued = { queued: false, reason: "enqueue_error" };
  }

  if (queued.queued) {
    return queued;
  }

  try {
    if (fallbackRawToken) {
      await sendVerificationEmail({
        userId,
        rawToken: fallbackRawToken,
      });
    } else {
      await sendFreshVerificationEmail({ userId, reason });
    }
  } catch (error) {
    console.warn("[email] verification fallback failed", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return queued;
};

export const dispatchFreshVerificationEmail = async (
  userId: number,
  options?: {
    reason?: "signup" | "manual";
    context?: AppQueueContextInput;
  },
) => {
  const token = await createEmailVerificationToken(userId);

  return dispatchVerificationEmail({
    userId,
    reason: options?.reason,
    context: options?.context,
    fallbackRawToken: token.rawToken,
  });
};

export const getEmailVerificationResendState = async (userId: number) => {
  const latestToken = await prisma.emailVerificationToken.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    select: {
      created_at: true,
    },
  });

  if (!latestToken) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  const availableAt =
    latestToken.created_at.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS;
  const retryAfterMs = availableAt - Date.now();

  if (retryAfterMs <= 0) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
};

export const getEmailVerificationOtpResendState = async (userId: number) => {
  const latestOtp = await prisma.otpCode.findFirst({
    where: {
      user_id: userId,
      purpose: "EMAIL_VERIFICATION",
      consumed_at: null,
    },
    orderBy: { created_at: "desc" },
    select: {
      resend_available_at: true,
      expires_at: true,
    },
  });

  if (!latestOtp) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      expiresInSeconds: Math.ceil(EMAIL_VERIFICATION_OTP_TTL_MS / 1000),
    };
  }

  const retryAfterMs = latestOtp.resend_available_at.getTime() - Date.now();
  const expiresInMs = latestOtp.expires_at.getTime() - Date.now();

  return {
    allowed: retryAfterMs <= 0 || expiresInMs <= 0,
    retryAfterSeconds:
      retryAfterMs > 0 ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0,
    expiresInSeconds:
      expiresInMs > 0
        ? Math.max(1, Math.ceil(expiresInMs / 1000))
        : Math.ceil(EMAIL_VERIFICATION_OTP_TTL_MS / 1000),
  };
};

const sendVerificationOtpEmail = async ({
  userId,
  email,
  name,
  code,
}: {
  userId: number;
  email: string;
  name: string;
  code: string;
}) =>
  sendEmail(
    "verify_email_otp",
    {
      email,
      user_name: name,
      code,
      expires_in_minutes: Math.ceil(EMAIL_VERIFICATION_OTP_TTL_MS / 60000),
    },
    {
      audit: {
        userId,
        metadata: {
          flow: "verify_email_otp",
        },
      },
    },
  );

export const issueEmailVerificationOtp = async (
  userId: number,
  options?: {
    force?: boolean;
  },
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      is_email_verified: true,
      deleted_at: true,
    },
  });

  if (
    !user ||
    user.deleted_at ||
    user.is_email_verified ||
    !user.email.trim()
  ) {
    return {
      status: "ignored" as const,
      message:
        "If an unverified account exists for this email, a verification code will arrive shortly.",
      retryAfter: Math.ceil(EMAIL_VERIFICATION_OTP_RESEND_COOLDOWN_MS / 1000),
      expiresIn: Math.ceil(EMAIL_VERIFICATION_OTP_TTL_MS / 1000),
      email: user?.email ?? null,
      maskedEmail: user?.email ? maskEmail(user.email) : null,
    };
  }

  const resendState = await getEmailVerificationOtpResendState(user.id);
  if (!options?.force && !resendState.allowed) {
    return {
      status: "cooldown" as const,
      message: `Please wait ${resendState.retryAfterSeconds}s before requesting another verification code.`,
      retryAfter: resendState.retryAfterSeconds,
      expiresIn: resendState.expiresInSeconds,
      email: user.email,
      maskedEmail: maskEmail(user.email),
    };
  }

  await prisma.otpCode.deleteMany({
    where: {
      user_id: user.id,
      purpose: "EMAIL_VERIFICATION",
    },
  });

  const code = generateOtpCode();
  const otpRecord = await prisma.otpCode.create({
    data: {
      user_id: user.id,
      purpose: "EMAIL_VERIFICATION",
      channel: "EMAIL",
      code_hash: hashSecretValue(code),
      expires_at: new Date(Date.now() + EMAIL_VERIFICATION_OTP_TTL_MS),
      resend_available_at: new Date(
        Date.now() + EMAIL_VERIFICATION_OTP_RESEND_COOLDOWN_MS,
      ),
      max_attempts: EMAIL_VERIFICATION_OTP_MAX_ATTEMPTS,
    },
  });

  try {
    await sendVerificationOtpEmail({
      userId: user.id,
      email: user.email,
      name: user.name,
      code,
    });
  } catch (error) {
    await prisma.otpCode.delete({
      where: { id: otpRecord.id },
    });
    throw error;
  }

  return {
    status: "sent" as const,
    message: `Verification code sent to ${maskEmail(user.email)}.`,
    retryAfter: Math.ceil(EMAIL_VERIFICATION_OTP_RESEND_COOLDOWN_MS / 1000),
    expiresIn: Math.ceil(EMAIL_VERIFICATION_OTP_TTL_MS / 1000),
    email: user.email,
    maskedEmail: maskEmail(user.email),
  };
};

export const resendEmailVerificationOtpForEmail = async (email: string) => {
  const normalizedEmail = normalizeEmailAddress(email);
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: {
      id: true,
      is_email_verified: true,
      deleted_at: true,
    },
  });

  if (!user || user.deleted_at || user.is_email_verified) {
    return {
      message:
        "If an unverified account exists for this email, a verification code will arrive shortly.",
      retryAfter: Math.ceil(EMAIL_VERIFICATION_OTP_RESEND_COOLDOWN_MS / 1000),
      expiresIn: Math.ceil(EMAIL_VERIFICATION_OTP_TTL_MS / 1000),
    };
  }

  const otpResult = await issueEmailVerificationOtp(user.id);

  return {
    message:
      otpResult.status === "cooldown"
        ? "A verification code was already sent recently. Please wait before trying again."
        : "If an unverified account exists for this email, a verification code will arrive shortly.",
    retryAfter: otpResult.retryAfter,
    expiresIn: otpResult.expiresIn,
  };
};

export const verifyEmailVerificationOtp = async ({
  email,
  otp,
}: {
  email: string;
  otp: string;
}) => {
  const normalizedEmail = normalizeEmailAddress(email);
  const normalizedOtp = otp.trim();
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      email: true,
      provider: true,
      image: true,
      is_email_verified: true,
      email_verified_at: true,
    },
  });

  if (!user) {
    return {
      status: "invalid" as const,
      message: "Invalid OTP",
    };
  }

  if (user.is_email_verified) {
    return {
      status: "already_verified" as const,
      user,
    };
  }

  const verificationOtp = await prisma.otpCode.findFirst({
    where: {
      user_id: user.id,
      purpose: "EMAIL_VERIFICATION",
      consumed_at: null,
    },
    orderBy: { created_at: "desc" },
  });

  if (!verificationOtp) {
    return {
      status: "invalid" as const,
      message: "Invalid OTP",
    };
  }

  if (verificationOtp.expires_at.getTime() <= Date.now()) {
    await prisma.otpCode.deleteMany({
      where: {
        user_id: user.id,
        purpose: "EMAIL_VERIFICATION",
      },
    });

    return {
      status: "expired" as const,
      message: "OTP expired. Please request a new one.",
    };
  }

  if (verificationOtp.attempts >= verificationOtp.max_attempts) {
    return {
      status: "locked" as const,
      message: "Too many incorrect attempts. Please request a new OTP.",
    };
  }

  if (hashSecretValue(normalizedOtp) !== verificationOtp.code_hash) {
    const nextAttempts = verificationOtp.attempts + 1;
    await prisma.otpCode.update({
      where: { id: verificationOtp.id },
      data: { attempts: nextAttempts },
    });

    return {
      status: nextAttempts >= verificationOtp.max_attempts ? "locked" as const : "invalid" as const,
      message:
        nextAttempts >= verificationOtp.max_attempts
          ? "Too many incorrect attempts. Please request a new OTP."
          : "Invalid OTP",
    };
  }

  const verifiedUser = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        is_email_verified: true,
        email_verified_at: new Date(),
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

    await tx.otpCode.deleteMany({
      where: {
        user_id: user.id,
        purpose: "EMAIL_VERIFICATION",
      },
    });

    await tx.emailVerificationToken.deleteMany({
      where: { user_id: user.id },
    });

    return updatedUser;
  });

  return {
    status: "verified" as const,
    user: verifiedUser,
  };
};

export const consumeEmailVerificationToken = async (rawToken: string) => {
  const tokenHash = hashSecretValue(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { token_hash: tokenHash },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          provider: true,
          image: true,
          is_email_verified: true,
        },
      },
    },
  });

  if (!record) {
    return {
      status: "invalid" as const,
    };
  }

  if (record.expires_at.getTime() <= Date.now()) {
    await prisma.emailVerificationToken.delete({
      where: { id: record.id },
    });

    return {
      status: "expired" as const,
      userId: record.user_id,
    };
  }

  const user = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: record.user_id },
      data: {
        is_email_verified: true,
        email_verified_at: new Date(),
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

    await tx.emailVerificationToken.deleteMany({
      where: { user_id: record.user_id },
    });

    return updatedUser;
  });

  return {
    status: "verified" as const,
    user,
  };
};
