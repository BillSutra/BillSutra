"use client";

import { Button } from "@/components/ui/button";

type InvoiceCheckoutActionProps = {
  buttonId?: string;
  itemCount: number;
  isLoading: boolean;
  disabled: boolean;
  buttonLabel: string;
  loadingLabel: string;
  readyLabel: string;
  missingLabel: string;
  readyHint: string;
  missingHint: string;
  itemCountLabel: string;
  onCheckout: () => void;
};

const InvoiceCheckoutAction = ({
  buttonId,
  itemCount,
  isLoading,
  disabled,
  buttonLabel,
  loadingLabel,
  readyLabel,
  missingLabel,
  readyHint,
  missingHint,
  itemCountLabel,
  onCheckout,
}: InvoiceCheckoutActionProps) => (
  <div className="mt-6 grid gap-3">
    <Button
      id={buttonId}
      type="button"
      size="lg"
      className="h-15 rounded-[1.2rem] text-base font-semibold shadow-[0_24px_48px_-28px_rgba(37,99,235,0.45)]"
      disabled={disabled}
      onClick={onCheckout}
    >
      {isLoading ? loadingLabel : buttonLabel}
    </Button>
    <div className="flex items-center justify-between rounded-[1.15rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/20 dark:text-emerald-100 dark:ring-emerald-900/40">
      <span>{itemCount === 0 ? missingLabel : readyLabel}</span>
      <span className="font-semibold">{itemCountLabel}</span>
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {itemCount === 0 ? missingHint : readyHint}
    </p>
  </div>
);

export default InvoiceCheckoutAction;
