"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";

const Hero = () => {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden bg-background pb-16 pt-14 text-foreground">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -left-12 top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),rgba(59,130,246,0))]" />
        <div className="absolute right-0 top-8 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.2),rgba(16,185,129,0))]" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {t("landing.hero.kicker")}
          </p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            {t("landing.hero.title")}
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            {t("landing.hero.description")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/register">{t("landing.hero.primaryCta")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="#product">{t("landing.hero.secondaryCta")}</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card/90 p-6 shadow-xl">
          <div className="rounded-2xl border border-dashed border-border bg-muted/60 p-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("landing.hero.previewLabel")}</span>
              <span>{t("landing.hero.live")}</span>
            </div>
            <div className="mt-6 grid gap-4">
              <div className="h-3 w-40 rounded-full bg-primary/40" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-20 rounded-xl bg-card shadow-sm" />
                <div className="h-20 rounded-xl bg-card shadow-sm" />
                <div className="h-20 rounded-xl bg-card shadow-sm" />
              </div>
              <div className="h-32 rounded-2xl bg-card shadow-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded-2xl bg-card shadow-sm" />
                <div className="h-24 rounded-2xl bg-card shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
