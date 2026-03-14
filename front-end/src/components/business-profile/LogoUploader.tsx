"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useBusinessLogo } from "@/hooks/useBusinessLogo";

/** Max upload size: 2 MB */
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

/** Accepted MIME types for the logo file. */
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

interface LogoUploaderProps {
  /** Called when a logo is successfully uploaded or removed */
  onLogoChange?: (base64Logo: string | null) => void;
}

/**
 * Self-contained logo upload / preview / remove widget.
 *
 * - Drag-and-drop or click-to-browse (PNG, JPG, JPEG, WebP ≤ 2 MB)
 * - Converts the file to a Base64 data-URL and stores it in localStorage
 *   via the centralised `useBusinessLogo` hook
 * - Shows a live preview of the uploaded logo
 * - Replace: re-upload with a new file (overwrites localStorage)
 * - Remove: deletes the logo from localStorage
 */
const LogoUploader = ({ onLogoChange }: LogoUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reactive logo state backed by localStorage
  const { logo, setLogo, removeLogo } = useBusinessLogo();
  const hasLogo = Boolean(logo);

  // ── File → Base64 conversion ─────────────────────────────────────────────

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  };

  // ── Validation & upload ──────────────────────────────────────────────────

  const validateAndUpload = async (file: File | null | undefined) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only PNG, JPG, JPEG, and WebP files are allowed.");
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      toast.error("File size must not exceed 2 MB.");
      return;
    }

    try {
      setIsProcessing(true);
      const base64 = await convertToBase64(file);

      // Persist to localStorage and trigger reactive updates app-wide
      setLogo(base64);
      onLogoChange?.(base64);

      toast.success(hasLogo ? "Logo replaced successfully." : "Logo uploaded successfully.");
    } catch {
      toast.error("Failed to process the image.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Remove handler ─────────────────────────────────────────────────────

  const handleRemove = () => {
    removeLogo();
    onLogoChange?.(null);
    toast.success("Logo removed.");
  };

  // ── Drag-and-drop handlers ──────────────────────────────────────────────

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    validateAndUpload(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Business Logo</p>

      {/* Drop zone / preview */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload logo"
        onClick={() => !isProcessing && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !isProcessing && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        className={[
          "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center",
          "rounded-2xl border-2 border-dashed transition-all",
          dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : hasLogo
              ? "border-border bg-white"
              : "border-[#d6c8b8] bg-[#faf6f1] hover:border-primary/60 hover:bg-primary/5",
          isProcessing ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        {hasLogo && logo ? (
          /* Logo preview */
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="Business logo"
              className="max-h-24 max-w-[200px] rounded-xl object-contain shadow-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Click or drag to replace
            </p>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8ddd4]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-5 w-5 text-[#8a6d56]"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#5c4b3b]">
              Upload a logo
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, JPEG or WebP · max 2 MB
            </p>
          </div>
        )}

        {/* Loading spinner overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => validateAndUpload(e.target.files?.[0])}
        // Reset value so the same file can be re-selected after removal
        onClick={(e) => ((e.currentTarget as HTMLInputElement).value = "")}
      />

      {/* Remove button */}
      {hasLogo && (
        <button
          type="button"
          disabled={isProcessing}
          onClick={handleRemove}
          className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-3.5 w-3.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
          Remove logo
        </button>
      )}
    </div>
  );
};

export default LogoUploader;
