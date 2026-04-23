import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.resolve(__dirname, "../../../uploads/payment-proofs");

const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export const paymentProofStorage = {
  async save(userId: number, file: Express.Multer.File) {
    const ext = ALLOWED_EXTENSIONS[file.mimetype];
    if (!ext) {
      throw Object.assign(new Error("Only JPG, JPEG, PNG, WEBP, and PDF proofs are allowed."), {
        status: 400,
      });
    }

    const userDir = path.join(UPLOADS_ROOT, String(userId));
    fs.mkdirSync(userDir, { recursive: true });

    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(userDir, uniqueName);

    fs.writeFileSync(filePath, file.buffer);

    return {
      url: `/uploads/payment-proofs/${userId}/${uniqueName}`,
      filePath,
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
