"use client";

import Link from "next/link";
import { CheckCircle2, Circle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BeginnerGuideStep = {
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  done?: boolean;
  active?: boolean;
};

type BeginnerGuideAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline";
};

type BeginnerGuideCardProps = {
  kicker: string;
  title: string;
  description: string;
  icon: LucideIcon;
  progressLabel?: string;
  steps: BeginnerGuideStep[];
  primaryAction?: BeginnerGuideAction;
  secondaryAction?: BeginnerGuideAction;
  className?: string;
};

const ActionButton = ({ action }: { action: BeginnerGuideAction }) => {
  if (action.href) {
    return (
      <Button asChild variant={action.variant ?? "default"}>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={action.variant ?? "default"}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
};

const BeginnerGuideCard = ({
  kicker,
  title,
  description,
  icon: Icon,
  progressLabel,
  steps,
  primaryAction,
  secondaryAction,
  className,
}: BeginnerGuideCardProps) => {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-[#eadfcf] bg-[linear-gradient(135deg,#fff8ec_0%,#fffdf8_45%,#f7fbff_100%)] p-6 shadow-[0_26px_60px_-42px_rgba(15,23,42,0.22)]",
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm">
            <Icon size={14} />
            <span>{kicker}</span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>

        {progressLabel ? (
          <div className="rounded-[1.35rem] border border-white/80 bg-white/85 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
            {progressLabel}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => {
          const isDone = Boolean(step.done);
          const isActive = Boolean(step.active);
          const StepIcon = isDone ? CheckCircle2 : Circle;

          return (
            <div
              key={`${step.title}-${index}`}
              className={cn(
                "rounded-[1.45rem] border px-4 py-4",
                isActive
                  ? "border-primary/35 bg-primary/5"
                  : isDone
                    ? "border-emerald-200 bg-emerald-50/80"
                    : "border-slate-200 bg-white/85",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5", isDone ? "text-emerald-600" : "text-slate-400")}>
                  <StepIcon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 font-semibold text-slate-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                  {step.href && step.actionLabel ? (
                    <div className="mt-4">
                      <Button asChild size="sm" variant={isActive ? "default" : "outline"}>
                        <Link href={step.href}>{step.actionLabel}</Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {primaryAction || secondaryAction ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          {secondaryAction ? <ActionButton action={secondaryAction} /> : null}
          {primaryAction ? <ActionButton action={primaryAction} /> : null}
        </div>
      ) : null}
    </section>
  );
};

export default BeginnerGuideCard;
