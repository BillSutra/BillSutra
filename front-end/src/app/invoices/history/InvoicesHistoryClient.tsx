"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import Modal from "@/components/ui/modal";
import { useInvoicesQuery } from "@/hooks/useInventoryQueries";
import type { Invoice } from "@/lib/apiClient";

type InvoicesHistoryClientProps = {
  name: string;
  image?: string;
};

const formatCurrency = (value: string) => {
  const amount = Number(value || 0);
  return `INR ${amount.toFixed(2)}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN");
};

const InvoicesHistoryClient = ({ name, image }: InvoicesHistoryClientProps) => {
  const { data, isLoading, isError } = useInvoicesQuery();
  const [query, setQuery] = useState("");
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const invoices = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return invoices;
    return invoices.filter((invoice) =>
      invoice.invoice_number?.toLowerCase().includes(normalized),
    );
  }, [invoices, query]);

  const statusVariant = (status: string) => {
    const value = status.toLowerCase();
    if (value === "paid") return "paid" as const;
    if (value === "pending") return "pending" as const;
    if (value === "overdue") return "overdue" as const;
    return "default" as const;
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title="Invoice history"
      subtitle="Search completed invoices by their unique invoice number."
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-gray-500">
            Invoices
          </p>
          <p className="max-w-2xl text-base text-gray-500">
            Search completed invoices by their unique invoice number.
          </p>
        </div>

        <section className="mt-6 grid gap-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Search invoices</h2>
                <p className="text-sm text-gray-500">
                  Type an invoice number like INV-0001.
                </p>
              </div>
              <div className="flex w-full max-w-md items-center gap-2">
                <Input
                  placeholder="Search by invoice number"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuery("")}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setQuickActionsOpen(true)}
                >
                  Quick actions
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Results</h2>
              <span className="text-sm text-gray-500">
                {filtered.length} shown
              </span>
            </div>

            <div className="mt-4">
              {isLoading && (
                <p className="text-sm text-gray-500">Loading invoices...</p>
              )}
              {isError && (
                <p className="text-sm text-[#b45309]">
                  Failed to load invoices.
                </p>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <p className="text-sm text-gray-500">No invoices found.</p>
              )}
              {!isLoading && !isError && filtered.length > 0 && (
                <DataTable
                  rows={filtered.map((invoice) => ({
                    id: invoice.id,
                    invoice_number: (
                      <span className="font-semibold">
                        {invoice.invoice_number}
                      </span>
                    ),
                    customer: invoice.customer?.name || "-",
                    date: formatDate(invoice.date),
                    status: (
                      <Badge variant={statusVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    ),
                    total: formatCurrency(invoice.total),
                    actions: (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                      >
                        <Link href={`/invoices/history/${invoice.id}`}>
                          View
                        </Link>
                      </Button>
                    ),
                  }))}
                  searchPlaceholder="Search invoice number"
                  searchKeys={["invoice_number", "customer", "date", "total"]}
                  columns={[
                    {
                      key: "invoice_number",
                      header: "Invoice No.",
                    },
                    {
                      key: "customer",
                      header: "Customer",
                    },
                    {
                      key: "date",
                      header: "Date",
                    },
                    {
                      key: "status",
                      header: "Status",
                    },
                    {
                      key: "total",
                      header: "Total",
                      className: "text-right",
                    },
                    {
                      key: "actions",
                      header: "Actions",
                      className: "text-right",
                    },
                  ]}
                />
              )}
            </div>
          </div>
        </section>

        <Modal
          open={quickActionsOpen}
          onOpenChange={setQuickActionsOpen}
          title="Quick actions"
          description="Start common billing tasks from one place."
        >
          <div className="grid gap-3">
            <Button
              asChild
              variant="primary"
              className="justify-start rounded-xl"
            >
              <Link href="/invoices">Create invoice</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="justify-start rounded-xl"
            >
              <Link href="/customers">Create client</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-start rounded-xl"
            >
              <Link href="/products">Edit product</Link>
            </Button>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default InvoicesHistoryClient;
