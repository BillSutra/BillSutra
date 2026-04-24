"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InvoiceWorkspaceV2Props = {
  title: string;
  description: string;
  draftBadgeLabel: string;
  draftMeta: string;
  invoiceNumberPreview: string;
  invoiceDateLabel: string;
  customerLabel: string;
  totalLabel: string;
  lineItemsLabel: string;
  bootstrapNotice: ReactNode;
  heroActions: ReactNode;
  customerNode: ReactNode;
  productsNode: ReactNode;
  totalsNode: ReactNode;
  actionsNode: ReactNode;
  previewNode: ReactNode;
  helperNode: ReactNode;
  draftsNode: ReactNode;
};

const collapsibleSectionClassName =
  "overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/90 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900/80";

const InvoiceWorkspaceV2 = ({
  title,
  description,
  draftBadgeLabel,
  draftMeta,
  invoiceNumberPreview,
  invoiceDateLabel,
  customerLabel,
  totalLabel,
  lineItemsLabel,
  bootstrapNotice,
  heroActions,
  customerNode,
  productsNode,
  totalsNode,
  actionsNode,
  previewNode,
  helperNode,
  draftsNode,
}: InvoiceWorkspaceV2Props) => {
  return (
    <div className="mx-auto w-full max-w-[1720px] font-[var(--font-sora),var(--font-geist-sans)]">
      {bootstrapNotice}

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-5 py-5 shadow-[0_22px_58px_-40px_rgba(15,23,42,0.2)] dark:border-slate-700 dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(15,23,42,0.92)_100%)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>POS workspace</Badge>
              <Badge variant="pending">{draftBadgeLabel}</Badge>
              <Badge>{lineItemsLabel}</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {description}
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {draftMeta}
            </p>
          </div>

          <div className="grid gap-3 xl:min-w-[250px] xl:max-w-[320px]">
            {heroActions}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Invoice no.", value: invoiceNumberPreview },
            { label: "Bill date", value: invoiceDateLabel },
            { label: "Customer", value: customerLabel },
            { label: "Live total", value: totalLabel },
          ].map((entry) => (
            <div
              key={entry.label}
              className="rounded-[1.2rem] border border-slate-200/80 bg-white/85 px-4 py-3 dark:border-slate-700/80 dark:bg-slate-950/60"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                {entry.label}
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                {entry.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,2.25fr)_minmax(320px,1.08fr)] xl:items-start">
        <div className="min-w-0">{customerNode}</div>
        <div className="min-w-0">{productsNode}</div>
        <aside className="grid gap-4 xl:sticky xl:top-24">
          {totalsNode}
          {actionsNode}
        </aside>
      </section>

      <section className="mt-5 grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <details className={collapsibleSectionClassName}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Preview
              </p>
              <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-100">
                Open live invoice preview
              </p>
            </div>
            <Button type="button" variant="outline" className="pointer-events-none rounded-full px-4">
              Expand
            </Button>
          </summary>
          <div className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-700/80">
            {previewNode}
          </div>
        </details>

        <div className="grid gap-4">
          <details className={cn(collapsibleSectionClassName, "open:shadow-sm")}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Support
                </p>
                <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-100">
                  Advanced help and billing guidance
                </p>
              </div>
              <Button type="button" variant="outline" className="pointer-events-none rounded-full px-4">
                Expand
              </Button>
            </summary>
            <div className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-700/80">
              {helperNode}
            </div>
          </details>

          <details className={collapsibleSectionClassName}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Drafts
                </p>
                <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-100">
                  Saved work and recoverable bills
                </p>
              </div>
              <Button type="button" variant="outline" className="pointer-events-none rounded-full px-4">
                Expand
              </Button>
            </summary>
            <div className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-700/80">
              {draftsNode}
            </div>
          </details>
        </div>
      </section>
    </div>
  );
};

export default InvoiceWorkspaceV2;
