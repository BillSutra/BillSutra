"use client";

import { Store, Truck, WalletCards } from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";
import TestimonialCard from "@/components/testimonial-card";

const Testimonials = () => {
  const { t } = useI18n();

  const stats = [
    {
      label: t("landing.testimonials.statOneLabel"),
      value: t("landing.testimonials.statOneValue"),
    },
    {
      label: t("landing.testimonials.statTwoLabel"),
      value: t("landing.testimonials.statTwoValue"),
    },
    {
      label: t("landing.testimonials.statThreeLabel"),
      value: t("landing.testimonials.statThreeValue"),
    },
  ];

  const testimonials = [
    {
      quote: t("landing.testimonials.items.one.quote"),
      name: t("landing.testimonials.items.one.name"),
      role: t("landing.testimonials.items.one.role"),
      icon: Store,
      initials: "PS",
      accent:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
    },
    {
      quote: t("landing.testimonials.items.two.quote"),
      name: t("landing.testimonials.items.two.name"),
      role: t("landing.testimonials.items.two.role"),
      icon: Truck,
      initials: "AM",
      accent:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    {
      quote: t("landing.testimonials.items.three.quote"),
      name: t("landing.testimonials.items.three.name"),
      role: t("landing.testimonials.items.three.role"),
      icon: WalletCards,
      initials: "NV",
      accent:
        "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
    },
  ];

  return (
    <section
      id="testimonials"
      className="bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] py-20 text-foreground dark:bg-[linear-gradient(180deg,#111113_0%,#18181b_100%)]"
    >
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
            {t("landing.testimonials.kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t("landing.testimonials.title")}
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-zinc-400">
            {t("landing.testimonials.description")}
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-5 shadow-[0_22px_50px_-42px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_20px_48px_-40px_rgba(0,0,0,0.48)]"
            >
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {testimonials.map((item) => (
            <TestimonialCard
              key={item.name}
              quote={item.quote}
              name={item.name}
              role={item.role}
              initials={item.initials}
              accent={item.accent}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
