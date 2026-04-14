"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  fetchUserSettingsPreferences,
  saveUserSettingsPreferences,
} from "@/lib/apiClient";
import { useI18n } from "@/providers/LanguageProvider";

export const usePersistedLanguage = () => {
  const queryClient = useQueryClient();
  const { language, setLanguage } = useI18n();
  const { status } = useSession();
  const settingsQuery = useQuery({
    queryKey: ["settings", "preferences"],
    queryFn: fetchUserSettingsPreferences,
    enabled: status === "authenticated",
    staleTime: 60000,
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
