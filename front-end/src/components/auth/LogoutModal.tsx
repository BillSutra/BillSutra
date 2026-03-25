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

const LogoutModal = ({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const { t } = useI18n();

  const logoutUser = () => {
    captureAnalyticsEvent("auth_logout", {
      source: "logout_modal",
    });
    resetAnalyticsUser();
    signOut({
      callbackUrl: "/login",
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
