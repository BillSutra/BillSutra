"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";

const Cta = () => {
  const { t } = useI18n();

  return (
    <section className="bg-background py-16">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="rounded-3xl border border-border bg-foreground px-8 py-10 text-background shadow-xl">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-background/70">
                {t("landing.cta.kicker")}
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                {t("landing.cta.title")}
              </h2>
              <p className="mt-2 text-sm text-background/70">
                {t("landing.cta.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="bg-background text-foreground hover:bg-muted"
              >
                <Link href="/register">{t("landing.cta.primaryCta")}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-background text-background hover:bg-background/10"
              >
                <Link href="#product">{t("landing.cta.secondaryCta")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Cta;
