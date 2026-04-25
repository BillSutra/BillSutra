import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_ROOT = path.resolve(__dirname, "../../uploads");
export const PUBLIC_UPLOADS_ROOT = path.join(UPLOADS_ROOT, "public");
export const PRIVATE_UPLOADS_ROOT = path.join(UPLOADS_ROOT, "private");
export const PUBLIC_LOGOS_ROOT = path.join(PUBLIC_UPLOADS_ROOT, "logos");
export const PRIVATE_PAYMENT_PROOFS_ROOT = path.join(
  PRIVATE_UPLOADS_ROOT,
  "payment-proofs",
);
export const LEGACY_LOGOS_ROOT = path.join(UPLOADS_ROOT, "logos");
export const LEGACY_PAYMENT_PROOFS_ROOT = path.join(
  UPLOADS_ROOT,
  "payment-proofs",
);

export const normalizeUploadRelativePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");

export const isPathInsideRoot = (root: string, candidatePath: string) => {
  const normalizedRoot = path.resolve(root);
  const normalizedCandidate = path.resolve(candidatePath);

  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
  );
};

export const resolveUploadPath = (root: string, relativePath: string) => {
  const normalizedRoot = path.resolve(root);
  const normalizedRelativePath = normalizeUploadRelativePath(relativePath);
  const resolvedPath = path.resolve(normalizedRoot, normalizedRelativePath);

  if (!isPathInsideRoot(normalizedRoot, resolvedPath)) {
    throw new Error("Invalid upload path.");
  }

  return resolvedPath;
};

export const getRelativeUploadPath = (root: string, absolutePath: string) => {
  const normalizedRoot = path.resolve(root);
  const normalizedAbsolutePath = path.resolve(absolutePath);

  if (!isPathInsideRoot(normalizedRoot, normalizedAbsolutePath)) {
    return null;
  }

  return path.relative(normalizedRoot, normalizedAbsolutePath).split(path.sep).join("/");
};

export const buildPublicUploadUrl = (relativePath: string) =>
  `/uploads/public/${normalizeUploadRelativePath(relativePath)}`;
