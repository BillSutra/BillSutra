"use client";

import type { ReactNode } from "react";

type DashboardSectionIntroProps = {
  headingId: string;
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export const dashboardSectionFallback = (height: string) => (
  <div className={`app-loading-skeleton w-full ${height}`} />
);

export const DashboardSectionIntro = ({
  headingId,
  kicker,
  title,
  description,
  action,
}: DashboardSectionIntroProps) => (
  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
    <div className="max-w-3xl">
      <p className="app-kicker">{kicker}</p>
      <h2
        id={headingId}
        className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-[1.4rem]"
      >
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
    {action ? <div className="flex shrink-0">{action}</div> : null}
  </div>
);
