import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { StorageProvider } from "./storage.provider.js";
import {
  PUBLIC_LOGOS_ROOT,
  buildPublicUploadUrl,
} from "../../lib/uploadPaths.js";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

/**
 * Local disk implementation of StorageProvider.
 *
 * Files are saved to:  <server-root>/uploads/public/logos/<userId>/<uuid>.<ext>
 * Public URL served as: /uploads/public/logos/<userId>/<uuid>.<ext>
 *
 * filePath stored in DB = the absolute path on disk (used for deletion).
 * url returned to client = the relative public URL (served via express.static).
 */
export const localStorageProvider: StorageProvider = {
  async save(userId, file) {
    const ext = ALLOWED_EXTENSIONS[file.mimetype];
    if (!ext) {
      throw Object.assign(new Error("Invalid file type."), { status: 400 });
    }

    const userDir = path.join(PUBLIC_LOGOS_ROOT, String(userId));
    fs.mkdirSync(userDir, { recursive: true });

    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(userDir, uniqueName);

    fs.writeFileSync(filePath, file.buffer);

    const url = buildPublicUploadUrl(`logos/${userId}/${uniqueName}`);

    return { url, filePath };
  },

  async delete(filePath) {
    try {
      fs.unlinkSync(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  },
};
