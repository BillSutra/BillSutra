"use client";

import React from "react";
import AssistantChat from "@/components/assistant/AssistantChat";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useI18n } from "@/providers/LanguageProvider";

type AssistantClientProps = {
  name: string;
  image?: string;
  token?: string;
};

const AssistantClient = ({ name, image, token }: AssistantClientProps) => {
  const { t } = useI18n();
  const displayName = name.trim() || t("common.guest");

  return (
    <DashboardLayout
      name={displayName}
      image={image}
      title={t("assistant.title")}
      subtitle={t("assistant.subtitle")}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="grid gap-2">
          <p className="app-kicker">{t("assistant.introKicker")}</p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-[1.4rem]">
            {t("assistant.introTitle")}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {t("assistant.introDescription")}
          </p>
        </section>

        <AssistantChat />
      </div>
    </DashboardLayout>
  );
};

export default AssistantClient;
