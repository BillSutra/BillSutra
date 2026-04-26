"use client";

import Link from "next/link";
import { ArrowRight, Bot, LineChart, PackageSearch, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";
import AIChatPreview from "@/components/ai-chat-preview";

const AIAssistantSection = () => {
  const { t } = useI18n();

  const capabilities = [
    {
      icon: LineChart,
      title: t("landing.ai.capabilities.profitTitle"),
      description: t("landing.ai.capabilities.profitDescription"),
    },
    {
      icon: PackageSearch,
      title: t("landing.ai.capabilities.stockTitle"),
      description: t("landing.ai.capabilities.stockDescription"),
    },
    {
      icon: ReceiptText,
      title: t("landing.ai.capabilities.invoiceTitle"),
      description: t("landing.ai.capabilities.invoiceDescription"),
    },
  ];

  return (
    <section
      id="ai-assistant"
      className="relative overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_44%,#f0f7ff_100%)] py-20 dark:bg-[linear-gradient(180deg,#0b1020_0%,#09090b_42%,#111113_100%)]"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(129,140,248,0.16),transparent_24%)]" />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 shadow-[0_16px_34px_-26px_rgba(37,99,235,0.24)] dark:border-blue-500/20 dark:bg-zinc-900 dark:text-blue-300">
            <Bot className="h-3.5 w-3.5" />
            {t("landing.ai.kicker")}
          </div>
          <h2 className="mt-5 max-w-xl text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t("landing.ai.title")}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-zinc-400">
            {t("landing.ai.description")}
          </p>

          <div className="mt-8 grid gap-4">
            {capabilities.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.55rem] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.1)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_26px_54px_-34px_rgba(37,99,235,0.14)] dark:border-zinc-800 dark:bg-zinc-900/92 dark:hover:shadow-[0_20px_46px_-34px_rgba(0,0,0,0.48)]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#6366f1)] text-white shadow-[0_18px_36px_-26px_rgba(37,99,235,0.38)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-xl px-6">
              <Link href="/register">
                {t("landing.ai.primaryCta")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-xl px-6"
            >
              <Link href="#product">{t("landing.ai.secondaryCta")}</Link>
            </Button>
          </div>
        </div>

        <AIChatPreview
          chatLabel={t("landing.ai.chatLabel")}
          chatTitle={t("landing.ai.chatTitle")}
          userQuestion={t("landing.ai.userQuestion")}
          assistantAnswer={t("landing.ai.assistantAnswer")}
          followupLabel={t("landing.ai.followupLabel")}
          typingLabel={t("landing.ai.typingLabel")}
          prompts={[
            t("landing.ai.prompts.one"),
            t("landing.ai.prompts.two"),
            t("landing.ai.prompts.three"),
          ]}
          inputPlaceholder={t("landing.ai.inputPlaceholder")}
        />
      </div>
    </section>
  );
};

export default AIAssistantSection;
