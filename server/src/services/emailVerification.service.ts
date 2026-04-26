import crypto from "node:crypto";
import prisma from "../config/db.config.js";
import { sendEmail } from "../emails/index.js";
import { buildVerifyEmailUrl } from "../lib/appUrls.js";
import { hashSecretValue } from "../lib/modernAuth.js";
import { enqueueEmailVerificationEmail } from "../queues/jobs/email.jobs.js";

const EMAIL_VERIFICATION_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

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

export const dispatchVerificationEmail = async ({
  userId,
  rawToken,
}: {
  userId: number;
  rawToken: string;
}) => {
  let queued:
    | ({ queued: boolean } & Record<string, unknown>)
    | { queued: false; reason: "enqueue_error" };

  try {
    queued = await enqueueEmailVerificationEmail({
      userId,
      rawToken,
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
    await sendVerificationEmail({ userId, rawToken });
  } catch (error) {
    console.warn("[email] verification fallback failed", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return queued;
};

export const dispatchFreshVerificationEmail = async (userId: number) => {
  const token = await createEmailVerificationToken(userId);
  await dispatchVerificationEmail({
    userId,
    rawToken: token.rawToken,
  });

  return token;
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
      data: { is_email_verified: true },
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
