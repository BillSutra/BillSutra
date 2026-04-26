"use client";

import { Quote, Star, Store, Truck, WalletCards } from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";

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
    },
    {
      quote: t("landing.testimonials.items.two.quote"),
      name: t("landing.testimonials.items.two.name"),
      role: t("landing.testimonials.items.two.role"),
      icon: Truck,
    },
    {
      quote: t("landing.testimonials.items.three.quote"),
      name: t("landing.testimonials.items.three.name"),
      role: t("landing.testimonials.items.three.role"),
      icon: WalletCards,
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
            <article
              key={item.name}
              className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-46px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_22px_52px_-42px_rgba(0,0,0,0.48)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_18px_36px_-28px_rgba(37,99,235,0.52)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <Quote className="h-5 w-5 text-amber-500" />
              </div>

              <div className="mt-5 flex items-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </div>

              <p className="mt-4 text-base leading-7 text-slate-700 dark:text-zinc-300">
                {item.quote}
              </p>
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {item.name}
                </p>
                <p className="mt-1 text-sm text-zinc-500">{item.role}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
