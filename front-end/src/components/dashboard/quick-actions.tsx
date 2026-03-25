import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bolt } from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  { label: "Create Invoice", href: "/invoices", tone: "sales" },
  { label: "Add Product", href: "/products", tone: "neutral" },
  { label: "Add Customer", href: "/customers", tone: "sales" },
  { label: "Record Payment", href: "/invoices", tone: "sales" },
  { label: "Add Purchase", href: "/purchases", tone: "purchase" },
] as const;

const toneClassName: Record<(typeof actions)[number]["tone"], string> = {
  sales:
    "border-emerald-200/70 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
  purchase:
    "border-orange-200/70 bg-orange-50/70 text-orange-900 hover:bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-100",
  neutral:
    "border-border/80 bg-card/90 text-foreground hover:bg-accent/50 dark:bg-card/70",
};

const QuickActions = ({ className }: { className?: string }) => {
  return (
    <Card
      className={cn(
        "dashboard-chart-surface h-fit self-start gap-0 rounded-[1.75rem] py-6",
        className,
      )}
    >
      <CardHeader className="dashboard-chart-content gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-border/70 bg-card/80 p-2 text-primary shadow-sm">
            <Bolt size={18} />
          </div>
          <div>
            <p className="app-kicker">Shortcuts</p>
            <CardTitle className="mt-1 text-lg text-foreground">
              Quick actions
            </CardTitle>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Jump into common billing, catalog, and purchasing flows without extra
          navigation.
        </p>
      </CardHeader>
      <CardContent className="dashboard-chart-content grid gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            asChild
            variant="outline"
            className={cn(
              "group h-auto justify-between rounded-2xl px-4 py-3 text-left shadow-[0_16px_34px_-26px_rgba(31,27,22,0.22)] transition hover:-translate-y-0.5",
              toneClassName[action.tone],
            )}
          >
            <Link
              href={action.href}
              className="flex w-full items-center justify-between gap-3"
            >
              <span className="font-medium">{action.label}</span>
              <ArrowRight
                size={16}
                className="shrink-0 transition-transform group-hover:translate-x-1"
              />
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};

export default QuickActions;
