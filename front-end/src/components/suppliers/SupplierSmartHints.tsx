"use client";

import { Lightbulb, MapPin } from "lucide-react";

type SupplierSmartHintsProps = {
  gstinHint?: string;
  pincodeHint?: string;
};

const SupplierSmartHints = ({
  gstinHint,
  pincodeHint,
}: SupplierSmartHintsProps) => {
  if (!gstinHint && !pincodeHint) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
      {gstinHint && (
        <p className="inline-flex items-center gap-1">
          <Lightbulb className="h-3.5 w-3.5" />
          {gstinHint}
        </p>
      )}
      {pincodeHint && (
        <p className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {pincodeHint}
        </p>
      )}
    </div>
  );
};

export default SupplierSmartHints;
