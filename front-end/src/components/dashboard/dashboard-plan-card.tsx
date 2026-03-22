"use client";

import Link from "next/link";
import { ArrowRight, BrainCircuit, Crown, Package, Receipt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FREE_PLAN_LIMITS,
  getUpgradeUrgency,
  getUsageProgress,
} from "@/lib/pricingPlans";

type DashboardPlanCardProps = {
  monthlyInvoiceCount: number;
  productCount: number;
};

const usageTone = {
  healthy: {
    shell: "border-emerald-200/70 bg-emerald-50/80",
    bar: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
    copy: "You still have room to grow on Free.",
  },
  warning: {
    shell: "border-amber-200/70 bg-amber-50/90",
    bar: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700",
    copy: "You are close to your Free plan limit.",
  },
  critical: {
    shell: "border-rose-200/70 bg-rose-50/90",
    bar: "bg-rose-500",
    badge: "bg-rose-100 text-rose-700",
    copy: "You have reached a Free plan limit. Pro removes the cap.",
  },
} as const;

const premiumPreviews = [
  {
    title: "Smart Suggestions",
    description: "Cross-sell prompts and recent products inside the POS flow.",
    icon: BrainCircuit,
  },
  {
    title: "Professional PDFs",
    description: "Branded invoices with logo, GST details, and polished layouts.",
    icon: Sparkles,
  },
  {
    title: "Basic analytics",
    description: "See sales trends and top products without extra spreadsheets.",
    icon: Crown,
  },
];

const UsageBar = ({
  label,
  value,
  limit,
  tone,
}: {
  label: string;
  value: number;
  limit: number;
  tone: keyof typeof usageTone;
}) => {
  const progress = getUsageProgress(value, limit);

  return (
    <div className="rounded-2xl border border-border/70 bg-white/85 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {value}/{limit}
        </p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[#ece5d9]">
        <div
          className={cn("h-full rounded-full transition-all", usageTone[tone].bar)}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{progress}% of Free plan limit used</p>
    </div>
  );
};

const DashboardPlanCard = ({
  monthlyInvoiceCount,
  productCount,
}: DashboardPlanCardProps) => {
  const invoiceProgress = getUsageProgress(
    monthlyInvoiceCount,
    FREE_PLAN_LIMITS.invoicesPerMonth,
  );
  const productProgress = getUsageProgress(productCount, FREE_PLAN_LIMITS.products);
  const topProgress = Math.max(invoiceProgress, productProgress);
  const tone = getUpgradeUrgency(topProgress);
  const usageMessage =
    topProgress >= 80
      ? `You have used ${topProgress}% of your Free plan allowance.`
      : "Free stays generous for setup, but Pro is priced for everyday Indian small-business billing.";

  return (
    <section
      className={cn(
        "dashboard-chart-surface rounded-[1.75rem] border px-6 py-6",
        usageTone[tone].shell,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="app-kicker">Your plan</p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">
            Free plan with upgrade cues that match your usage
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {usageMessage} {usageTone[tone].copy}
          </p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", usageTone[tone].badge)}>
          {tone === "healthy"
            ? "Low-risk start"
            : tone === "warning"
              ? "80% used"
              : "Upgrade recommended"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        <UsageBar
          label="Invoices this month"
          value={monthlyInvoiceCount}
          limit={FREE_PLAN_LIMITS.invoicesPerMonth}
          tone={tone}
        />
        <UsageBar
          label="Products stored"
          value={productCount}
          limit={FREE_PLAN_LIMITS.products}
          tone={tone}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {premiumPreviews.map((preview) => {
          const Icon = preview.icon;

          return (
            <div
              key={preview.title}
              className="relative overflow-hidden rounded-3xl border border-border/70 bg-white/85 p-4"
            >
              <div className="absolute inset-x-5 top-3 h-8 rounded-full bg-gradient-to-r from-transparent via-white/75 to-transparent blur-md" />
              <div className="relative">
                <div className="inline-flex rounded-2xl border border-border/70 bg-[#f8f4ec] p-2 text-[#8a6b45]">
                  <Icon className="size-4" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">{preview.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {preview.description}
                </p>
                <div className="mt-3 inline-flex rounded-full border border-dashed border-violet-300 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                  Included in Pro from Rs 499/month
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/pricing">
            Compare plans
            <ArrowRight size={16} />
          </Link>
        </Button>
        <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border/70 bg-white/85 px-3 py-2 text-xs font-medium text-muted-foreground">
          <Receipt className="size-4" />
          Upgrade when billing volume grows past 50 invoices/month
        </div>
        <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border/70 bg-white/85 px-3 py-2 text-xs font-medium text-muted-foreground">
          <Package className="size-4" />
          Product storage nudges kick in as you approach 100 items
        </div>
      </div>
    </section>
  );
};

export default DashboardPlanCard;
