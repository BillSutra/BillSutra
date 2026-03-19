"use client";

import { useI18n } from "@/providers/LanguageProvider";

const PricingPlaceholder = () => {
  const { t } = useI18n();

  const tiers = [
    {
      name: t("landing.pricing.tiers.starterName"),
      price: t("landing.pricing.tiers.starterPrice"),
      description: t("landing.pricing.tiers.starterDescription"),
    },
    {
      name: t("landing.pricing.tiers.growthName"),
      price: t("landing.pricing.tiers.growthPrice"),
      description: t("landing.pricing.tiers.growthDescription"),
    },
    {
      name: t("landing.pricing.tiers.proName"),
      price: t("landing.pricing.tiers.proPrice"),
      description: t("landing.pricing.tiers.proDescription"),
    },
  ];

  return (
    <section id="pricing" className="bg-background py-16">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {t("landing.pricing.kicker")}
          </p>
          <h2 className="text-3xl font-semibold">
            {t("landing.pricing.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("landing.pricing.description")}
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="rounded-2xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {tier.name}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {tier.price}
              </p>
              <p className="mt-2">{tier.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingPlaceholder;
