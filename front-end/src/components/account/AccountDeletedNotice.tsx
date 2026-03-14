"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "account_deleted_message";

const AccountDeletedNotice = () => {
  useEffect(() => {
    const message = window.sessionStorage.getItem(STORAGE_KEY);
    if (!message) return;

    toast.success(message);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return null;
};

export default AccountDeletedNotice;
