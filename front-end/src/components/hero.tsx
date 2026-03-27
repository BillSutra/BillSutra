"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  ReceiptText,
} from "lucide-react";
import BrandLogo from "@/components/branding/BrandLogo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";

const Hero = () => {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#f9f5ee_42%,#ffffff_100%)] pb-20 pt-12 text-foreground sm:pb-24 sm:pt-16">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-[-10%] top-14 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(18,61,101,0.16),rgba(18,61,101,0))]" />
        <div className="absolute right-[-8%] top-0 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(210,165,85,0.18),rgba(210,165,85,0))]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.92)_100%)]" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-6 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e4f1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#6c8298] shadow-[0_16px_36px_-28px_rgba(18,61,101,0.32)]">
            <BadgeCheck className="h-3.5 w-3.5 text-[#123d65]" />
            {t("landing.hero.kicker")}
          </div>

          <div className="space-y-5">
            <BrandLogo
              priority
              className="hidden sm:inline-flex"
              textClassName="text-left"
            />
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-[#10233f] md:text-5xl lg:text-[3.75rem]">
              {t("landing.hero.title")}
            </h1>
          </div>

          <p className="max-w-2xl text-base leading-7 text-[#5f7389] sm:text-lg">
            {t("landing.hero.description")}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl bg-[#123d65] px-6 text-white shadow-[0_18px_36px_-26px_rgba(18,61,101,0.6)] hover:bg-[#0f3252]"
            >
              <Link href="/register">{t("landing.hero.primaryCta")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-xl border-[#cfdded] bg-white/85 px-6 text-[#123d65] hover:bg-[#f6fbff]"
            >
              <Link href="#product">{t("landing.hero.secondaryCta")}</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-[#5f7389]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e4f1] bg-white/88 px-4 py-2 shadow-[0_14px_30px_-24px_rgba(18,61,101,0.25)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2f8f68]" />
              {t("landing.hero.trustIndicator")}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfcf] bg-[#fffaf2] px-4 py-2 text-[#7d664d] shadow-[0_14px_30px_-26px_rgba(125,102,77,0.32)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#d2a555]" />
              {t("landing.hero.secondaryIndicator")}
            </div>
          </div>

          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            {[
              t("landing.hero.pillBilling"),
              t("landing.hero.pillInventory"),
              t("landing.hero.pillInsights"),
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/80 bg-white/78 px-4 py-4 text-sm font-medium text-[#38516b] shadow-[0_18px_40px_-34px_rgba(18,61,101,0.35)] backdrop-blur"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-5 top-10 hidden rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_26px_60px_-38px_rgba(18,61,101,0.4)] backdrop-blur lg:block">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#edf5fb] p-2.5 text-[#123d65]">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#7d90a3]">
                  {t("landing.hero.floatingCardLabel")}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#10233f]">
                  {t("landing.hero.floatingCardValue")}
                </p>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-6 right-2 hidden rounded-2xl border border-[#eadfcf] bg-[#fffaf2]/96 p-4 shadow-[0_26px_60px_-40px_rgba(125,102,77,0.4)] backdrop-blur lg:block">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#fff1d8] p-2.5 text-[#b67c2e]">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#99744a]">
                  {t("landing.hero.floatingInsightLabel")}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#5d4423]">
                  {t("landing.hero.floatingInsightValue")}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/82 p-4 shadow-[0_40px_100px_-54px_rgba(18,61,101,0.48)] backdrop-blur-xl sm:p-5">
            <div className="rounded-[1.7rem] border border-[#d7e4f1] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9fd_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#6f849a]">
                    {t("landing.hero.previewLabel")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#10233f]">
                    {t("landing.hero.previewTitle")}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e4f1] bg-white px-3 py-1.5 text-xs font-semibold text-[#49617a]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2f8f68]" />
                  {t("landing.hero.live")}
                </div>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-[#dce7f1] bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <BrandLogo
                      showTagline={false}
                      iconClassName="h-10 w-10 p-1.5"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[#10233f]">
                        BillSutra
                      </p>
                      <p className="text-xs text-[#73879b]">
                        {t("landing.hero.previewSubtitle")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-9 rounded-lg bg-[#123d65] px-3 text-white hover:bg-[#0f3252]"
                  >
                    {t("landing.hero.previewAction")}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#d7e4f1] bg-[#f8fbff] p-4">
                    <div className="flex items-center gap-2 text-[#123d65]">
                      <ReceiptText className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#73879b]">
                        {t("landing.hero.statRevenueLabel")}
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-[#10233f]">
                      {t("landing.hero.statRevenueValue")}
                    </p>
                    <p className="mt-1 text-xs text-[#6b8094]">
                      {t("landing.hero.statRevenueHint")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#eadfcf] bg-[#fffaf2] p-4">
                    <div className="flex items-center gap-2 text-[#a36b2e]">
                      <Boxes className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7558]">
                        {t("landing.hero.statInventoryLabel")}
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-[#5d4423]">
                      {t("landing.hero.statInventoryValue")}
                    </p>
                    <p className="mt-1 text-xs text-[#8b7558]">
                      {t("landing.hero.statInventoryHint")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#d8ece4] bg-[#f4fbf8] p-4">
                    <div className="flex items-center gap-2 text-[#2f8f68]">
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c7f71]">
                        {t("landing.hero.statGrowthLabel")}
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-[#134b39]">
                      {t("landing.hero.statGrowthValue")}
                    </p>
                    <p className="mt-1 text-xs text-[#5c7f71]">
                      {t("landing.hero.statGrowthHint")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                  <div className="rounded-[1.5rem] border border-[#dce7f1] bg-[#f8fbff] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#10233f]">
                        {t("landing.hero.chartTitle")}
                      </p>
                      <p className="text-xs text-[#73879b]">
                        {t("landing.hero.chartRange")}
                      </p>
                    </div>
                    <div className="mt-5 flex h-40 items-end gap-3">
                      {[44, 68, 54, 86, 73, 92, 88].map((height, index) => (
                        <div
                          key={height}
                          className="flex flex-1 flex-col items-center gap-2"
                        >
                          <div
                            className="w-full rounded-t-2xl bg-[linear-gradient(180deg,#123d65_0%,#4f83b3_100%)]"
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#7a8ea3]">
                            {t(`landing.hero.chartLabels.${index + 1}`)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-[1.4rem] border border-[#dce7f1] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#73879b]">
                        {t("landing.hero.sideCardOneLabel")}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#10233f]">
                        {t("landing.hero.sideCardOneValue")}
                      </p>
                      <p className="mt-2 text-sm text-[#627890]">
                        {t("landing.hero.sideCardOneDescription")}
                      </p>
                    </div>
                    <div className="rounded-[1.4rem] border border-[#eadfcf] bg-[#fffaf2] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7558]">
                        {t("landing.hero.sideCardTwoLabel")}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#5d4423]">
                        {t("landing.hero.sideCardTwoValue")}
                      </p>
                      <p className="mt-2 text-sm text-[#80684b]">
                        {t("landing.hero.sideCardTwoDescription")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
