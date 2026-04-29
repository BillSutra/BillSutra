"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  Package,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type BillingCycle,
  formatPricingAmount,
  formatPlanPeriodLabel,
  formatPlanPrice,
  getAnnualSavings,
  getMonthlyEquivalent,
  pricingPlans,
} from "@/lib/pricingPlans";
import {
  switchToFreePlan,
  type SubscriptionSnapshot,
} from "@/lib/apiClient";
import {
  useSubscriptionStatusQuery,
  workspaceQueryKeys,
} from "@/hooks/useWorkspaceQueries";

type PricingProps = {
  isAuthenticated?: boolean;
};

const comparisonRows = [
  {
    label: "Invoices",
    values: ["50/month", "Unlimited", "Unlimited"],
    icon: Receipt,
  },
  {
    label: "Products",
    values: ["100", "2,500", "Unlimited"],
    icon: Package,
  },
  {
    label: "Payment tracking",
    values: [
      "Paid and pending",
      "Paid, pending, partial",
      "Full tracking with history",
    ],
    icon: Receipt,
  },
  {
    label: "Analytics",
    values: ["Preview only", "Basic analytics", "Advanced reports"],
    icon: BarChart3,
  },
  {
    label: "Suggestions",
    values: ["Not included", "Smart Suggestions", "Smart Suggestions"],
    icon: BrainCircuit,
  },
  {
    label: "Team access",
    values: ["Owner only", "Owner focused", "Multi-user staff"],
    icon: Users,
  },
];

type PlanAction = {
  href?: string;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
};

const planAction = ({
  planId,
  isAuthenticated,
  subscription,
  onSwitchToFree,
}: {
  planId: string;
  isAuthenticated: boolean;
  subscription: SubscriptionSnapshot | undefined;
  onSwitchToFree: () => void;
}): PlanAction => {
  if (!isAuthenticated) {
    return {
      href: `/register?plan=${planId}`,
      label:
        planId === "free"
          ? "Start Free"
          : planId === "pro"
            ? "Start Pro Trial"
            : "Start with Pro Plus",
    };
  }

  const currentPlan = subscription?.planId;
  if (currentPlan === planId) {
    return {
      label: "Current plan",
      disabled: true,
    };
  }

  if (planId === "free") {
    return {
      label: "Switch to Free",
      onClick: onSwitchToFree,
    };
  }

  return {
    href: `/payments/access?plan=${planId}`,
    label: planId === "pro" ? "Upgrade to Pro" : "Upgrade to Pro Plus",
  };
};

const Pricing = ({ isAuthenticated = false }: PricingProps) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const queryClient = useQueryClient();

  const { data: subscription } = useSubscriptionStatusQuery({
    enabled: isAuthenticated,
  });

  const switchToFreeMutation = useMutation({
    mutationFn: switchToFreePlan,
    onSuccess: () => {
      toast.success("Switched to Free plan.");
      void queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.subscriptionStatus,
      });
      void queryClient.invalidateQueries({
        queryKey: ["payment-access-status"],
      });
    },
    onError: () => {
      toast.error("Could not switch plan right now. Please try again.");
    },
  });

  const currentUsageCopy = useMemo(() => {
    if (!subscription) {
      return null;
    }

    const limit = subscription.limits.invoicesPerMonth;
    if (limit === null) {
      return `${subscription.usage.invoicesCreated} invoices created this month (unlimited plan).`;
    }

    return `${subscription.usage.invoicesCreated} / ${limit} invoices used this month.`;
  }, [subscription]);

  return (
    <section id="pricing" className="bg-background py-16 sm:py-20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8a6b45]">
              India-first pricing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Fair plans for small businesses that need speed, clarity, and
              local value
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Start free, upgrade only when your billing volume grows, and keep
              every invoice GST-ready and customer-friendly from day one. No
              hidden fees. No forced setup calls.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 rounded-3xl border border-border/80 bg-card/90 p-3 shadow-sm">
            <div className="flex items-center gap-2 rounded-full bg-[#f3eadc] p-1 text-sm">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "rounded-full px-4 py-2 font-medium transition",
                  billingCycle === "monthly"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "rounded-full px-4 py-2 font-medium transition",
                  billingCycle === "yearly"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                Yearly
              </button>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              Pay yearly and save around 20% on Pro and Pro Plus.
            </p>
          </div>
        </div>

        {isAuthenticated && subscription ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-900">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              Current subscription
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {subscription.planName} • {subscription.status}
            </p>
            <p className="mt-1 text-sm text-[#6a635b]">{currentUsageCopy}</p>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-3">
          {pricingPlans.map((plan) => {
            const action = planAction({
              planId: plan.id,
              isAuthenticated,
              subscription,
              onSwitchToFree: () => {
                if (!switchToFreeMutation.isPending) {
                  switchToFreeMutation.mutate();
                }
              },
            });
            const savings = getAnnualSavings(plan);
            const monthlyEquivalent = getMonthlyEquivalent(plan);

            return (
              <article
                key={plan.id}
                className={cn(
                  "relative overflow-hidden rounded-[2rem] border px-6 py-6 text-left",
                  plan.accentClassName,
                  plan.highlight && "xl:-translate-y-3",
                )}
              >
                <div className="flex min-h-full flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-transparent bg-muted text-foreground hover:bg-muted">
                      {plan.kicker}
                    </Badge>
                    {plan.badge ? (
                      <Badge className="border-violet-200 bg-violet-100 text-violet-700 hover:bg-violet-100">
                        {plan.badge}
                      </Badge>
                    ) : null}
                    {plan.trialLabel ? (
                      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        {plan.trialLabel}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <h3 className="text-2xl font-semibold text-foreground">
                      {plan.name}
                    </h3>
                    <p className="mt-3 min-h-16 text-sm leading-6 text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-end gap-2">
                    <p className="text-4xl font-semibold tracking-tight text-foreground">
                      {formatPlanPrice(plan, billingCycle)}
                    </p>
                    <p className="pb-1 text-sm text-muted-foreground">
                      {formatPlanPeriodLabel(plan, billingCycle)}
                    </p>
                  </div>

                  {billingCycle === "yearly" && savings > 0 ? (
                    <div className="mt-2 space-y-1 text-sm font-medium text-emerald-700">
                      <p>Save {formatPricingAmount(savings)} every year</p>
                      {monthlyEquivalent ? (
                        <p className="text-xs font-medium text-muted-foreground">
                          Works out to about{" "}
                          {formatPricingAmount(monthlyEquivalent)} per month on
                          annual billing
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-6 rounded-2xl border border-border/70 bg-white/75 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Included
                    </p>
                    <ul className="mt-3 space-y-2.5 text-sm text-foreground">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {plan.limitations?.length ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/70 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                        Upgrade triggers
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-amber-900/80">
                        {plan.limitations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl bg-[#f8f4ec] p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Why teams upgrade
                    </p>
                    <ul className="mt-2 space-y-2">
                      {plan.upgradeHighlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6">
                    {action.href ? (
                      <Button
                        asChild
                        size="lg"
                        variant={plan.highlight ? "default" : "outline"}
                        className="w-full"
                        disabled={action.disabled}
                      >
                        <Link href={action.href}>
                          {action.label}
                          <ArrowRight size={16} />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        variant={plan.highlight ? "default" : "outline"}
                        className="w-full"
                        disabled={
                          action.disabled || switchToFreeMutation.isPending
                        }
                        onClick={action.onClick}
                      >
                        {action.label}
                        <ArrowRight size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div
          id="compare-plans"
          className="overflow-hidden rounded-[2rem] border border-border/80 bg-card/95 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.35)]"
        >
          <div className="border-b border-border/80 px-6 py-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Compare plans
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  Clear limits, local pricing, easy upgrade path
                </h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="size-4" />
                INR pricing with annual savings shown upfront
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-border/70 md:grid-cols-[minmax(180px,0.9fr)_repeat(3,minmax(0,1fr))]">
            <div className="hidden bg-[#f8f4ec] px-5 py-4 text-sm font-semibold text-foreground md:block">
              Feature
            </div>
            {pricingPlans.map((plan) => (
              <div
                key={`heading-${plan.id}`}
                className={cn(
                  "bg-[#f8f4ec] px-5 py-4 text-sm font-semibold text-foreground",
                  plan.highlight && "bg-violet-50",
                )}
              >
                {plan.name}
              </div>
            ))}

            {comparisonRows.map((row) => {
              const Icon = row.icon;

              return (
                <FragmentRow
                  key={row.label}
                  label={row.label}
                  icon={<Icon className="size-4 text-muted-foreground" />}
                  values={row.values}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

type FragmentRowProps = {
  label: string;
  icon: ReactNode;
  values: string[];
};

const FragmentRow = ({ label, icon, values }: FragmentRowProps) => (
  <>
    <div className="flex items-center gap-2 bg-white px-5 py-4 text-sm font-medium text-foreground">
      {icon}
      <span>{label}</span>
    </div>
    {values.map((value, index) => (
      <div
        key={`${label}-${index}`}
        className="bg-white px-5 py-4 text-sm text-muted-foreground"
      >
        {value}
      </div>
    ))}
  </>
);

export default Pricing;
