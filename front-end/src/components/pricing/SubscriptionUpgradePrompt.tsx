"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UpgradePromptState = {
  open: boolean;
  message: string;
  requiredPlan: string | null;
};

const SubscriptionUpgradePrompt = () => {
  const [state, setState] = useState<UpgradePromptState>({
    open: false,
    message: "This feature requires a higher plan.",
    requiredPlan: null,
  });

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{
        message?: string;
        requiredPlan?: string | null;
      }>;

      setState({
        open: true,
        message:
          typeof customEvent.detail?.message === "string"
            ? customEvent.detail.message
            : "This feature requires a higher plan.",
        requiredPlan:
          typeof customEvent.detail?.requiredPlan === "string"
            ? customEvent.detail.requiredPlan
            : null,
      });
    };

    window.addEventListener("billsutra:subscription-required", listener);
    return () => {
      window.removeEventListener("billsutra:subscription-required", listener);
    };
  }, []);

  return (
    <AlertDialog
      open={state.open}
      onOpenChange={(open) => setState((prev) => ({ ...prev, open }))}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            Upgrade required
          </AlertDialogTitle>
          <AlertDialogDescription>
            {state.message}
            {state.requiredPlan
              ? ` Recommended plan: ${state.requiredPlan}.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction asChild>
            <Link href="/pricing">View plans</Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SubscriptionUpgradePrompt;
