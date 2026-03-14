/**
 * StorageProvider — pluggable storage interface.
 *
 * To switch from local disk to S3/Cloudinary/Firebase:
 *  1. Implement this interface in a new file (e.g. s3Storage.ts)
 *  2. Change the `storageProvider` export below to point to your new implementation.
 *  All other code (controller, routes) remains unchanged.
 */

export interface StorageProvider {
  /**
   * Persist the uploaded file and return a publicly accessible URL and an
   * internal file reference (used later for deletion).
   */
  save(
    userId: number,
    file: Express.Multer.File,
  ): Promise<{ url: string; filePath: string }>;

  /**
   * Remove a previously saved file using its internal file reference.
   * Should resolve silently even if the file no longer exists.
   */
  delete(filePath: string): Promise<void>;
}

// ── Active implementation ──────────────────────────────────────────────────
// Swap this import to use a different storage backend.
import { localStorageProvider } from "./localStorage.js";

export const storageProvider: StorageProvider = localStorageProvider;
