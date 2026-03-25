"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet,
  Boxes,
  Users,
  Truck,
  LineChart,
  Receipt,
} from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";

const brandList = ["StudioNine", "KiteSupply", "UrbanMart", "ByteCraft"];

const Features = () => {
  const { t } = useI18n();

  const features = [
    {
      title: t("landing.features.items.invoiceManagementTitle"),
      description: t("landing.features.items.invoiceManagementDescription"),
      icon: Receipt,
    },
    {
      title: t("landing.features.items.inventoryTrackingTitle"),
      description: t("landing.features.items.inventoryTrackingDescription"),
      icon: Boxes,
    },
    {
      title: t("landing.features.items.customerManagementTitle"),
      description: t("landing.features.items.customerManagementDescription"),
      icon: Users,
    },
    {
      title: t("landing.features.items.supplierManagementTitle"),
      description: t("landing.features.items.supplierManagementDescription"),
      icon: Truck,
    },
    {
      title: t("landing.features.items.businessAnalyticsTitle"),
      description: t("landing.features.items.businessAnalyticsDescription"),
      icon: LineChart,
    },
    {
      title: t("landing.features.items.paymentTrackingTitle"),
      description: t("landing.features.items.paymentTrackingDescription"),
      icon: Wallet,
    },
  ];

  return (
    <section id="features" className="bg-background py-16 text-foreground">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {t("landing.features.trustedBy")}
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground sm:grid-cols-4">
            {brandList.map((brand) => (
              <div
                key={brand}
                className="rounded-full border border-border bg-card px-4 py-2 text-center"
              >
                {brand}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-semibold">
              {t("landing.features.title")}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {t("landing.features.description")}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <feature.icon size={18} />
                </span>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
