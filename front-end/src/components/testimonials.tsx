"use client";

import { Quote, Store, Truck, WalletCards } from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";

const Testimonials = () => {
  const { t } = useI18n();

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
      className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] py-20 text-foreground"
    >
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7a8ea4]">
            {t("landing.testimonials.kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#10233f] sm:text-4xl">
            {t("landing.testimonials.title")}
          </h2>
          <p className="mt-3 text-base leading-7 text-[#627890]">
            {t("landing.testimonials.description")}
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {testimonials.map((item) => (
            <article
              key={item.name}
              className="rounded-[1.75rem] border border-[#dce7f1] bg-white p-6 shadow-[0_24px_60px_-46px_rgba(18,61,101,0.3)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#123d65] text-white shadow-[0_18px_36px_-28px_rgba(18,61,101,0.52)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <Quote className="h-5 w-5 text-[#d2a555]" />
              </div>
              <p className="mt-5 text-base leading-7 text-[#445a70]">
                {item.quote}
              </p>
              <div className="mt-6">
                <p className="text-sm font-semibold text-[#10233f]">{item.name}</p>
                <p className="mt-1 text-sm text-[#73879b]">{item.role}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
