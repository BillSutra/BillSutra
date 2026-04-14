import React from "react";
import { cn } from "@/lib/utils";

type ProfileOverviewStatTone = "neutral" | "success" | "warning" | "info";

type ProfileOverviewStatProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: ProfileOverviewStatTone;
};

const toneClasses: Record<ProfileOverviewStatTone, string> = {
  neutral:
    "border-[#ecdccf] bg-white/95 text-[#1f1b16] shadow-[0_20px_45px_-34px_rgba(31,27,22,0.22)]",
  success:
    "border-emerald-200/80 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100",
  warning:
    "border-amber-200/80 bg-amber-50/90 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100",
  info: "border-sky-200/80 bg-sky-50/85 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100",
};

const ProfileOverviewStat = ({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: ProfileOverviewStatProps) => {
  return (
    <article className={cn("rounded-2xl border p-4", toneClasses[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">
            {label}
          </p>
          <p className="mt-2 truncate text-lg font-semibold leading-tight">
            {value}
          </p>
          {hint ? <p className="mt-1.5 text-xs opacity-80">{hint}</p> : null}
        </div>
        {icon ? (
          <div className="rounded-xl border border-current/15 bg-white/70 p-2.5 text-current dark:bg-white/10">
            {icon}
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default ProfileOverviewStat;
