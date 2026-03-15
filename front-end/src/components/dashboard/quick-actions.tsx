import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bolt } from "lucide-react";

const actions = [
  { label: "Create Invoice", href: "/invoices", tone: "sales" },
  { label: "Add Product", href: "/products", tone: "neutral" },
  { label: "Add Customer", href: "/customers", tone: "sales" },
  { label: "Record Payment", href: "/invoices", tone: "sales" },
  { label: "Add Purchase", href: "/purchases", tone: "purchase" },
];

const QuickActions = ({ className }: { className?: string }) => {
  return (
    <Card className={`dashboard-chart-surface h-fit self-start gap-0 py-6 rounded-[1.75rem] ${className}`}>
      <CardHeader className="dashboard-chart-content gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#f2e6dc] bg-white/80 p-2 text-[#b45309]">
            <Bolt size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#8a6d56]">
              Shortcuts
            </p>
            <CardTitle className="mt-1 text-lg text-[#1f1b16]">
              Quick actions
            </CardTitle>
          </div>
        </div>
        <p className="text-sm text-[#8a6d56]">
          Jump into the most common sales, customer, and purchase flows.
        </p>
      </CardHeader>
      <CardContent className="dashboard-chart-content grid gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            asChild
            variant="outline"
            className={`group h-auto justify-between rounded-2xl border px-4 py-3 text-left shadow-[0_16px_34px_-26px_rgba(31,27,22,0.38)] transition hover:-translate-y-0.5 ${
              action.tone === "sales"
                ? "border-emerald-200 bg-emerald-50/75 text-emerald-900 hover:bg-emerald-50"
                : action.tone === "purchase"
                  ? "border-orange-200 bg-orange-50/75 text-orange-900 hover:bg-orange-50"
                  : "border-[#f2e6dc] bg-white/85 text-[#1f1b16] hover:bg-white"
            }`}
          >
            <Link href={action.href} className="flex w-full items-center justify-between gap-3">
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
