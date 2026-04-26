"use client";

import {
  BarChart3,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  ReceiptText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/providers/LanguageProvider";

const ProductPreview = () => {
  const { t } = useI18n();

  const previewCards = [
    {
      title: t("landing.preview.dashboardTitle"),
      description: t("landing.preview.dashboardDescription"),
      icon: LayoutDashboard,
      tone:
        "border-blue-200 bg-blue-50/70 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
      lines: [
        t("landing.preview.dashboardPointOne"),
        t("landing.preview.dashboardPointTwo"),
      ],
    },
    {
      title: t("landing.preview.billingTitle"),
      description: t("landing.preview.billingDescription"),
      icon: ReceiptText,
      tone:
        "border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
      lines: [
        t("landing.preview.billingPointOne"),
        t("landing.preview.billingPointTwo"),
      ],
    },
    {
      title: t("landing.preview.reportsTitle"),
      description: t("landing.preview.reportsDescription"),
      icon: BarChart3,
      tone:
        "border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
      lines: [
        t("landing.preview.reportsPointOne"),
        t("landing.preview.reportsPointTwo"),
      ],
    },
  ];

  return (
    <section
      id="product"
      className="bg-[linear-gradient(180deg,#ffffff_0%,#f6faff_48%,#f8fbff_100%)] py-20 dark:bg-[linear-gradient(180deg,#09090b_0%,#111113_48%,#18181b_100%)]"
    >
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
            {t("landing.preview.kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t("landing.preview.title")}
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-zinc-400">
            {t("landing.preview.description")}
          </p>
        </div>

        <Card className="group mt-10 overflow-hidden rounded-[2.2rem] border border-white/80 bg-white/88 shadow-[0_36px_84px_-52px_rgba(15,23,42,0.22)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_46px_94px_-52px_rgba(37,99,235,0.26)] dark:border-zinc-800 dark:bg-zinc-900/92 dark:hover:shadow-[0_30px_74px_-44px_rgba(0,0,0,0.58)]">
          <CardContent className="p-5 sm:p-6">
            <div className="relative rounded-[1.7rem] border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="absolute right-5 top-5 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.16),rgba(59,130,246,0))] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    {t("landing.preview.surfaceLabel")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    {t("landing.preview.surfaceTitle")}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-[0_10px_20px_-16px_rgba(37,99,235,0.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                  {t("landing.preview.surfaceStatus")}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {previewCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-[1.55rem] border border-slate-200 bg-white p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.1)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_26px_48px_-30px_rgba(37,99,235,0.14)] dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className={`rounded-2xl border px-3 py-3 ${card.tone}`}>
                        <card.icon className="h-5 w-5" />
                      </div>
                      <div className="flex gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                      </div>
                    </div>

                    <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                      {card.description}
                    </p>

                    <div className="mt-4 space-y-2.5">
                      {card.lines.map((line) => (
                        <div
                          key={line}
                          className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  t("landing.preview.pointOne"),
                  t("landing.preview.pointTwo"),
                  t("landing.preview.pointThree"),
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-24px_rgba(37,99,235,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ProductPreview;
