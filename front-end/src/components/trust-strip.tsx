"use client";

import { ShieldCheck, Sparkles, Star, Store } from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";

const TrustStrip = () => {
  const { t } = useI18n();

  const items = [
    {
      icon: Store,
      value: t("landing.trust.items.businesses.value"),
      label: t("landing.trust.items.businesses.label"),
      tone:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
    },
    {
      icon: ShieldCheck,
      value: t("landing.trust.items.uptime.value"),
      label: t("landing.trust.items.uptime.label"),
      tone:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    {
      icon: Star,
      value: t("landing.trust.items.rating.value"),
      label: t("landing.trust.items.rating.label"),
      tone:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    },
    {
      icon: Sparkles,
      value: t("landing.trust.items.setup.value"),
      label: t("landing.trust.items.setup.label"),
      tone:
        "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
    },
  ];

  return (
    <section className="border-y border-slate-200/80 bg-white/92 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-zinc-800 dark:bg-zinc-950/88">
      <div className="mx-auto grid w-full max-w-7xl gap-3 px-6 md:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-900/92"
          >
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${item.tone}`}
            >
              <item.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-950 dark:text-white">
                {item.value}
              </p>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                {item.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrustStrip;
