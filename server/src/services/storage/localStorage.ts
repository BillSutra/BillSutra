import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import type { StorageProvider } from "./storage.provider.js";

// Resolve <repo-root>/server/uploads/logos relative to this compiled file.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When compiled: dist/services/storage/ → ../../.. → server root → uploads/logos
// When run via tsx: src/services/storage/ → ../../.. → server root → uploads/logos
const UPLOADS_ROOT = path.resolve(__dirname, "../../../uploads/logos");

const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/svg+xml": ".svg",
};

/**
 * Local disk implementation of StorageProvider.
 *
 * Files are saved to:  <server-root>/uploads/logos/<userId>/<uuid>.<ext>
 * Public URL served as: /uploads/logos/<userId>/<uuid>.<ext>
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

    const userDir = path.join(UPLOADS_ROOT, String(userId));
    fs.mkdirSync(userDir, { recursive: true });

    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(userDir, uniqueName);

    fs.writeFileSync(filePath, file.buffer);

    // Public URL: /uploads/logos/<userId>/<filename>
    const url = `/uploads/logos/${userId}/${uniqueName}`;

    return { url, filePath };
  },

  async delete(filePath) {
    try {
      fs.unlinkSync(filePath);
    } catch (err: unknown) {
      // Silently ignore "file not found" — it may have been cleaned up already.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  },
};
