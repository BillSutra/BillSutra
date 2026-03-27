"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";

const Cta = () => {
  const { t } = useI18n();

  return (
    <section className="bg-white py-20">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="overflow-hidden rounded-[2rem] border border-[#123d65]/10 bg-[linear-gradient(135deg,#123d65_0%,#204e79_52%,#d2a555_180%)] px-8 py-10 text-white shadow-[0_40px_100px_-56px_rgba(18,61,101,0.58)] sm:px-10 sm:py-12">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
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
                className="h-12 rounded-xl bg-white px-6 text-[#123d65] hover:bg-[#f6fbff]"
              >
                <Link href="/register">
                  {t("landing.cta.primaryCta")}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-white/50 bg-transparent px-6 text-white hover:bg-white/10"
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
