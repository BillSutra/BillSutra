"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, ScanLine, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Html5QrcodeModule = typeof import("html5-qrcode");
type Html5QrcodeInstance = InstanceType<Html5QrcodeModule["Html5Qrcode"]>;

type BarcodeScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
  onManualEntry?: () => void;
};

const cameraErrorMessage =
  "Camera access failed. Allow camera permission or use manual entry.";

const BarcodeScannerDialog = ({
  open,
  onOpenChange,
  onScan,
  onManualEntry,
}: BarcodeScannerDialogProps) => {
  const rawReaderId = useId();
  const readerId = `barcode-reader-${rawReaderId.replace(/:/g, "")}`;
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState("");

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      setIsScanning(false);
      return;
    }

    try {
      await scanner.stop();
    } catch {
      // Scanner may already be stopped by the browser or successful decode.
    }

    try {
      await scanner.clear();
    } catch {
      // Clearing can fail if the element was already unmounted.
    }

    scannerRef.current = null;
    setIsScanning(false);
  }, []);

  const closeDialog = useCallback(() => {
    void stopScanner();
    onOpenChange(false);
  }, [onOpenChange, stopScanner]);

  const startScanner = useCallback(async () => {
    setScannerError("");
    if (scannerRef.current) {
      return;
    }

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } =
        await import("html5-qrcode");
      const scanner = new Html5Qrcode(readerId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });

      scannerRef.current = scanner;
      setIsScanning(true);

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 260, height: 180 },
          aspectRatio: 1.777,
        },
        (decodedText) => {
          const scannedValue = decodedText.trim();
          if (!scannedValue) return;
          onScan(scannedValue);
          closeDialog();
        },
        () => undefined,
      );
    } catch (error) {
      scannerRef.current = null;
      setIsScanning(false);
      const message =
        error instanceof Error && error.name === "NotAllowedError"
          ? "Camera permission was denied. Use manual entry or allow camera access."
          : cameraErrorMessage;
      setScannerError(message);
    }
  }, [closeDialog, onScan, readerId]);

  useEffect(() => {
    if (!open) {
      void stopScanner();
    }

    return () => {
      void stopScanner();
    };
  }, [open, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? closeDialog() : onOpenChange(true))}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Scan barcode
          </DialogTitle>
          <DialogDescription>
            Point the camera at an EAN, UPC, CODE128, or QR code.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-950">
            <div
              id={readerId}
              className="min-h-[280px] w-full [&_video]:min-h-[280px] [&_video]:w-full [&_video]:object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-64 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_999px_rgba(2,6,23,0.42)]" />
            </div>
            {!isScanning ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/72 px-6 text-center text-white">
                <Camera className="h-8 w-8 text-sky-300" />
                <p className="text-sm">
                  Start the scanner when you are ready to use this device camera.
                </p>
              </div>
            ) : null}
          </div>

          {scannerError ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {scannerError}
            </p>
          ) : null}

          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            Manual entry is always available if camera permission is blocked or
            the package barcode is damaged.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onManualEntry?.();
              closeDialog();
            }}
          >
            Manual Entry
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void stopScanner()}
              disabled={!isScanning}
            >
              <Square className="h-4 w-4" />
              Stop Scan
            </Button>
            <Button
              type="button"
              onClick={() => void startScanner()}
              disabled={isScanning}
            >
              <ScanLine className="h-4 w-4" />
              Start Scan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;
