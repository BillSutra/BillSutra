"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UpgradePromptData = {
  code: "SUBSCRIPTION_REQUIRED" | "PLAN_LIMIT_REACHED";
  message: string;
  requiredPlan: "free" | "pro" | "pro-plus" | null;
};

const UpgradePromptDialog = () => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<UpgradePromptData | null>(null);

  useEffect(() => {
    const handleUpgradeRequired = (event: Event) => {
      if (event instanceof CustomEvent) {
        setData(event.detail as UpgradePromptData);
        setOpen(true);
      }
    };

    window.addEventListener(
      "billsutra:subscription-required",
      handleUpgradeRequired,
    );

    return () => {
      window.removeEventListener(
        "billsutra:subscription-required",
        handleUpgradeRequired,
      );
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-3">
            <AlertCircle className="mt-1 size-5 shrink-0 text-amber-600" />
            <span>Upgrade to continue</span>
          </DialogTitle>
          <DialogDescription className="mt-4">
            {data?.message}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Button asChild className="gap-2">
            <Link href={`/payments/access?plan=${data?.requiredPlan || "pro"}`}>
              {data?.code === "PLAN_LIMIT_REACHED"
                ? "Upgrade Now"
                : "See plans"}
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="gap-2"
          >
            <X size={16} />
            Maybe later
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Upgrade to {data?.requiredPlan === "pro-plus" ? "Pro Plus" : "Pro"} to
          enable this feature and unlock more value.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePromptDialog;
