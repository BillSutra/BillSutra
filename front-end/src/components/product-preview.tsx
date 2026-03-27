"use client";

import {
  CheckCircle2,
  CircleDashed,
  CreditCard,
  PackageOpen,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/providers/LanguageProvider";

const ProductPreview = () => {
  const { t } = useI18n();

  return (
    <section
      id="product"
      className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_44%,#f6f0e7_100%)] py-20"
    >
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e4f1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#73879b]">
            <Sparkles className="h-3.5 w-3.5 text-[#123d65]" />
            {t("landing.preview.kicker")}
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-[#10233f] sm:text-4xl">
            {t("landing.preview.title")}
          </h2>
          <p className="max-w-2xl text-base leading-7 text-[#627890]">
            {t("landing.preview.description")}
          </p>
          <div className="grid gap-3 text-sm text-[#546a80]">
            {[
              t("landing.preview.pointOne"),
              t("landing.preview.pointTwo"),
              t("landing.preview.pointThree"),
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/78 px-4 py-4 shadow-[0_18px_40px_-34px_rgba(18,61,101,0.28)]"
              >
                <CheckCircle2 size={18} className="mt-0.5 text-[#2f8f68]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/82 shadow-[0_40px_100px_-54px_rgba(18,61,101,0.42)] backdrop-blur-xl">
          <CardContent className="p-5 sm:p-6">
            <div className="rounded-[1.7rem] border border-[#dce7f1] bg-[linear-gradient(180deg,#ffffff_0%,#f6faff_100%)] p-5">
              <div className="flex items-center justify-between text-xs text-[#73879b]">
                <span>{t("landing.preview.surfaceLabel")}</span>
                <span>{t("landing.preview.surfaceStatus")}</span>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#dce7f1] bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-[#123d65]">
                      <CreditCard className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#73879b]">
                        {t("landing.preview.metricOneLabel")}
                      </span>
                    </div>
                    <p className="mt-3 text-xl font-semibold text-[#10233f]">
                      {t("landing.preview.metricOneValue")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#eadfcf] bg-[#fffaf2] p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-[#b67c2e]">
                      <PackageOpen className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b7558]">
                        {t("landing.preview.metricTwoLabel")}
                      </span>
                    </div>
                    <p className="mt-3 text-xl font-semibold text-[#5d4423]">
                      {t("landing.preview.metricTwoValue")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#d8ece4] bg-[#f4fbf8] p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-[#2f8f68]">
                      <CircleDashed className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5c7f71]">
                        {t("landing.preview.metricThreeLabel")}
                      </span>
                    </div>
                    <p className="mt-3 text-xl font-semibold text-[#134b39]">
                      {t("landing.preview.metricThreeValue")}
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[#dce7f1] bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#10233f]">
                      {t("landing.preview.chartTitle")}
                    </p>
                    <p className="text-xs text-[#73879b]">
                      {t("landing.preview.chartRange")}
                    </p>
                  </div>
                  <div className="mt-5 flex h-44 items-end gap-3">
                    {[38, 52, 64, 58, 84, 72, 94].map((height) => (
                      <div key={height} className="flex flex-1 flex-col justify-end">
                        <div
                          className="w-full rounded-t-2xl bg-[linear-gradient(180deg,#123d65_0%,#5f93c2_100%)]"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-[#dce7f1] bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#73879b]">
                      {t("landing.preview.cardOneLabel")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#10233f]">
                      {t("landing.preview.cardOneValue")}
                    </p>
                    <p className="mt-2 text-sm text-[#627890]">
                      {t("landing.preview.cardOneDescription")}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-[#eadfcf] bg-[#fffaf2] p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7558]">
                      {t("landing.preview.cardTwoLabel")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#5d4423]">
                      {t("landing.preview.cardTwoValue")}
                    </p>
                    <p className="mt-2 text-sm text-[#80684b]">
                      {t("landing.preview.cardTwoDescription")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ProductPreview;
