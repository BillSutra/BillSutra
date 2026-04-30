"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  saveUserSettingsPreferences,
} from "@/lib/apiClient";
import { useUserSettingsPreferencesQuery } from "@/hooks/useWorkspaceQueries";
import { useI18n } from "@/providers/LanguageProvider";

export const usePersistedLanguage = () => {
  const queryClient = useQueryClient();
  const { language, setLanguage } = useI18n();
  const { status } = useSession();
  const settingsQuery = useUserSettingsPreferencesQuery({
    enabled: status === "authenticated",
  });

  const mutation = useMutation({
    mutationFn: async (nextLanguage: "en" | "hi") => {
      setLanguage(nextLanguage);
      if (status !== "authenticated") {
        return null;
      }
      const current = settingsQuery.data;
      return saveUserSettingsPreferences({
        appPreferences: {
          language: nextLanguage,
          currency: current?.appPreferences.currency ?? "INR",
          dateFormat: current?.appPreferences.dateFormat ?? "DD/MM/YYYY",
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "preferences"] });
    },
  });

  return {
    language,
    setPersistedLanguage: (nextLanguage: "en" | "hi") =>
      mutation.mutate(nextLanguage),
    isSavingLanguage: mutation.isPending,
  };
};
