"use client";

import React, { Dispatch, SetStateAction } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { signOut } from "next-auth/react";
import { useI18n } from "@/providers/LanguageProvider";
import {
  captureAnalyticsEvent,
  resetAnalyticsUser,
} from "@/lib/observability/client";
import { logoutCurrentSession } from "@/lib/apiClient";
import {
  clearClientAuthState,
  logClientAuthEvent,
} from "@/lib/secureAuth";
import { useSession } from "next-auth/react";

const LogoutModal = ({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const { t } = useI18n();
  const { data: session } = useSession();
  const callbackUrl =
    session?.user?.accountType === "WORKER" ? "/worker/login" : "/login";

  const logoutUser = async () => {
    logClientAuthEvent("logout_reason=manual");
    captureAnalyticsEvent("auth_logout", {
      source: "logout_modal",
    });
    resetAnalyticsUser();
    try {
      await logoutCurrentSession();
    } catch {
      // Best-effort: NextAuth sign-out should still proceed even if the
      // transitional backend logout endpoint is temporarily unavailable.
    }
    clearClientAuthState();
    await signOut({
      callbackUrl,
      redirect: true,
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("logoutModal.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("logoutModal.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={logoutUser}>
            {t("logoutModal.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LogoutModal;
