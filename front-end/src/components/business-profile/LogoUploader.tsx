"use client";

import { type DragEvent, useRef, useState } from "react";
import {
  ImagePlus,
  RefreshCcw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBusinessLogo } from "@/hooks/useBusinessLogo";
import { useI18n } from "@/providers/LanguageProvider";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

interface LogoUploaderProps {
  onLogoChange?: (base64Logo: string | null) => void;
}

const LogoUploader = ({ onLogoChange }: LogoUploaderProps) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { logo, setLogo, removeLogo } = useBusinessLogo();
  const hasLogo = Boolean(logo);
  const textPrimaryClassName = "text-[#10233f] dark:text-white";
  const textSecondaryClassName = "text-[#627890] dark:text-zinc-400";

  const convertToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });

  const validateAndUpload = async (file: File | null | undefined) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t("businessProfilePage.logo.messages.fileType"));
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      toast.error(t("businessProfilePage.logo.messages.fileSize"));
      return;
    }

    try {
      setIsProcessing(true);
      const base64 = await convertToBase64(file);
      setLogo(base64);
      onLogoChange?.(base64);
      toast.success(
        hasLogo
          ? t("businessProfilePage.logo.messages.replaced")
          : t("businessProfilePage.logo.messages.uploaded"),
      );
    } catch {
      toast.error(t("businessProfilePage.logo.messages.processError"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = () => {
    removeLogo();
    onLogoChange?.(null);
    toast.success(t("businessProfilePage.logo.messages.removed"));
  };

  const openPicker = () => {
    if (!isProcessing) {
      inputRef.current?.click();
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    void validateAndUpload(event.dataTransfer.files?.[0]);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className={`text-sm font-semibold ${textPrimaryClassName}`}>
          {t("businessProfilePage.logo.title")}
        </p>
        <p className={`text-sm leading-6 ${textSecondaryClassName}`}>
          Upload a crisp square or horizontal mark for invoices, portals, and
          branded documents.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={t("businessProfilePage.logo.uploadAriaLabel")}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        className={[
          "relative overflow-hidden rounded-[1.75rem] border-2 border-dashed transition-all duration-200",
          "bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
          dragOver
            ? "border-[#1d578c] bg-[#eef6ff] shadow-[0_20px_45px_-35px_rgba(17,37,63,0.45)] dark:border-blue-500 dark:bg-zinc-800 dark:ring-1 dark:ring-blue-500/30 dark:shadow-zinc-900/50"
            : "border-[#cfe0f0] hover:border-[#7aa8d6] hover:bg-[#f8fbff] dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
          isProcessing ? "pointer-events-none opacity-70" : "cursor-pointer",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-x-6 top-0 h-20 rounded-b-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),rgba(24,24,27,0))]" />
        <div className="relative space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d7e4f1] bg-white/90 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#7f95ab] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              <ImagePlus className="h-3.5 w-3.5" />
              Brand asset
            </span>
            <span className="text-xs font-medium text-[#7f95ab] dark:text-zinc-500">
              {t("businessProfilePage.logo.uploadDescription")}
            </span>
          </div>

          <div className="rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-[0_24px_50px_-42px_rgba(17,37,63,0.45)] transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-zinc-950/60">
            <div className="flex min-h-[15rem] items-center justify-center rounded-[1.35rem] border border-[#d7e4f1] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 transition-all duration-200 dark:border-zinc-700 dark:bg-zinc-800">
              {hasLogo && logo ? (
                <div className="flex w-full flex-col items-center gap-4">
                  <div className="flex aspect-[4/3] w-full max-w-[16rem] items-center justify-center overflow-hidden rounded-[1.25rem] border border-[#d7e4f1] bg-white p-4 shadow-[0_14px_30px_-26px_rgba(17,37,63,0.45)] transition-all duration-200 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-zinc-950/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo}
                      alt={t("businessProfilePage.logo.imageAlt")}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <p
                    className={`max-w-[18rem] text-center text-sm leading-6 ${textSecondaryClassName}`}
                  >
                    Your uploaded logo will stay proportional and appear on
                    branded invoice layouts automatically.
                  </p>
                </div>
              ) : (
                <div className="flex max-w-[18rem] flex-col items-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf2fa] text-[#123d65] shadow-[0_12px_26px_-20px_rgba(17,37,63,0.4)] dark:bg-zinc-800 dark:text-blue-400 dark:shadow-zinc-950/60">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div className="space-y-1.5">
                    <p className={`text-base font-semibold ${textPrimaryClassName}`}>
                      {t("businessProfilePage.logo.uploadTitle")}
                    </p>
                    <p className={`text-sm leading-6 ${textSecondaryClassName}`}>
                      Drag and drop your logo here, or click to choose a file.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isProcessing ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-[1.75rem] bg-white/78 backdrop-blur-sm dark:bg-zinc-950/75">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#123d65] border-t-transparent dark:border-blue-500 dark:border-t-transparent" />
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(event) => void validateAndUpload(event.target.files?.[0])}
        onClick={(event) => {
          (event.currentTarget as HTMLInputElement).value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-[#d7e4f1] bg-white/90 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          onClick={openPicker}
          disabled={isProcessing}
        >
          <RefreshCcw className="h-4 w-4" />
          {hasLogo ? "Replace logo" : "Choose file"}
        </Button>
        {hasLogo ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-red-200 bg-red-50/70 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300 dark:hover:border-red-800 dark:hover:bg-red-950/60 dark:hover:text-red-200"
            onClick={handleRemove}
            disabled={isProcessing}
          >
            <Trash2 className="h-4 w-4" />
            {t("businessProfilePage.logo.remove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default LogoUploader;
