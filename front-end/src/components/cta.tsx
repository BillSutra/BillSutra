"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";

const Cta = () => {
  const { t } = useI18n();

  return (
    <section className="bg-background py-20">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="overflow-hidden rounded-[2rem] border border-blue-500/10 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.22),transparent_28%),linear-gradient(135deg,#0f172a_0%,#1e3a8a_45%,#2563eb_100%)] px-8 py-10 text-white shadow-[0_40px_100px_-56px_rgba(37,99,235,0.52)] sm:px-10 sm:py-12">
          <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/72">
                {t("landing.cta.kicker")}
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("landing.cta.title")}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-white/78">
                {t("landing.cta.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-white px-6 text-blue-700 hover:bg-slate-100"
              >
                <Link href="/register">
                  {t("landing.cta.primaryCta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-white/30 bg-transparent px-6 text-white hover:bg-white/10"
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
