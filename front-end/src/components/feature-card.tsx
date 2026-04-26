"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FeatureCardProps = {
  title: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  tone: string;
};

const FeatureCard = ({
  title,
  description,
  eyebrow,
  icon: Icon,
  tone,
}: FeatureCardProps) => {
  return (
    <Card className="group relative overflow-hidden rounded-[1.9rem] border border-slate-200 bg-white shadow-[0_28px_60px_-42px_rgba(15,23,42,0.14)] transition-all duration-200 hover:-translate-y-1.5 hover:shadow-[0_34px_78px_-44px_rgba(37,99,235,0.2)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-[0_28px_62px_-42px_rgba(0,0,0,0.54)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(37,99,235,0.95),rgba(99,102,241,0.6),rgba(56,189,248,0.8))]" />
      <div className="absolute -right-10 top-6 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.16),rgba(59,130,246,0))] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <CardContent className="relative flex h-full flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <div
            className={cn(
              "flex h-13 w-13 items-center justify-center rounded-2xl border shadow-[0_18px_32px_-24px_rgba(37,99,235,0.34)]",
              tone,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-zinc-700 dark:group-hover:text-blue-400" />
        </div>
        <div className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          {eyebrow}
        </div>
        <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
          {title}
        </h3>
        <p className="text-sm leading-6 text-slate-600 dark:text-zinc-400">
          {description}
        </p>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;
