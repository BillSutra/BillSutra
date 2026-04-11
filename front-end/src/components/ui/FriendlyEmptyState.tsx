"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyAction = {
  href?: string;
  label: string;
  onClick?: () => void;
  variant?: "default" | "outline";
};

type FriendlyEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  hint?: string;
  primaryAction?: EmptyAction;
  secondaryAction?: EmptyAction;
  className?: string;
};

const ActionButton = ({ action }: { action: EmptyAction }) => {
  if (action.href) {
    return (
      <Button asChild variant={action.variant ?? "default"}>
        <Link href={action.href}>
          {action.label}
          <ArrowRight size={16} />
        </Link>
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
      <ArrowRight size={16} />
    </Button>
  );
};

const FriendlyEmptyState = ({
  icon: Icon,
  title,
  description,
  hint,
  primaryAction,
  secondaryAction,
  className,
}: FriendlyEmptyStateProps) => {
  return (
    <section
      className={cn(
        "rounded-[1.8rem] border border-dashed border-border/85 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--card)_94%,transparent)_0%,color-mix(in_oklab,var(--muted)_70%,transparent)_100%)] px-6 py-8 text-center shadow-[0_20px_45px_-38px_rgba(15,23,42,0.18)]",
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-border/80">
        <Icon size={24} />
      </div>
      <h3 className="mt-4 text-xl font-semibold text-foreground">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {hint ? (
        <p className="mx-auto mt-3 max-w-lg rounded-full bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground ring-1 ring-border/70">
          {hint}
        </p>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {primaryAction ? <ActionButton action={primaryAction} /> : null}
          {secondaryAction ? <ActionButton action={secondaryAction} /> : null}
        </div>
      ) : null}
    </section>
  );
};

export default FriendlyEmptyState;
