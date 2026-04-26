import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  LEGACY_PAYMENT_PROOFS_ROOT,
  PRIVATE_PAYMENT_PROOFS_ROOT,
} from "../../lib/uploadPaths.js";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export const paymentProofStorage = {
  async save(
    userId: number,
    file: Express.Multer.File,
    options?: {
      secure?: boolean;
    },
  ) {
    const ext = ALLOWED_EXTENSIONS[file.mimetype];
    if (!ext) {
      throw Object.assign(
        new Error("Only JPG, JPEG, PNG, WEBP, and PDF proofs are allowed."),
        {
          status: 400,
        },
      );
    }

    const uploadsRoot = options?.secure
      ? PRIVATE_PAYMENT_PROOFS_ROOT
      : LEGACY_PAYMENT_PROOFS_ROOT;
    const userDir = path.join(uploadsRoot, String(userId));
    fs.mkdirSync(userDir, { recursive: true });

    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(userDir, uniqueName);

    fs.writeFileSync(filePath, file.buffer);

    return {
      url: options?.secure
        ? `/uploads/private/payment-proofs/${userId}/${uniqueName}`
        : `/uploads/payment-proofs/${userId}/${uniqueName}`,
      filePath,
      secure: Boolean(options?.secure),
    };
  },
  async delete(filePath?: string | null) {
    if (!filePath) {
      return;
    }

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  },
};
