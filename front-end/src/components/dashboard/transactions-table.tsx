"use client";

import React, { useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardTransactions,
  type DashboardOverviewFilters,
} from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceiptText } from "lucide-react";
import { formatCurrency } from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

type TransactionRow = {
  date: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  paymentStatus: "PAID" | "PARTIAL" | "PENDING";
};

const buildColumns = (): ColumnDef<TransactionRow>[] => [
  {
    accessorKey: "date",
    header: "Date",
  },
  {
    accessorKey: "invoiceNumber",
    header: "Invoice",
  },
  {
    accessorKey: "customer",
    header: "Customer",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
        {formatCurrency(row.original.amount)}
      </span>
    ),
  },
  {
    accessorKey: "paymentStatus",
    header: "Payment Status",
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.paymentStatus === "PAID"
            ? "paid"
            : row.original.paymentStatus === "PENDING"
              ? "pending"
              : "default"
        }
      >
        {row.original.paymentStatus}
      </Badge>
    ),
  },
];

const TransactionsTable = ({
  filters,
}: {
  filters?: DashboardOverviewFilters;
}) => {
  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["dashboard", "transactions", filters],
    queryFn: () => fetchDashboardTransactions(filters),
    ...dashboardQueryDefaults,
  });

  const columns = useMemo(() => buildColumns(), []);

  const table = useReactTable({
    data: data?.transactions ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <Card className="dashboard-chart-surface gap-0 rounded-[1.75rem] py-6">
      <CardHeader className="dashboard-chart-content gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-border/70 bg-card/70 p-2 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <ReceiptText size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Ledger snapshot
            </p>
            <CardTitle className="mt-1 text-lg text-foreground">
              Recent transactions
            </CardTitle>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Track the latest invoices and payment status at a glance.
        </p>
        <DashboardCardStatus
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          dataUpdatedAt={dataUpdatedAt}
          refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
        />
      </CardHeader>
      <CardContent className="dashboard-chart-content">
        {isLoading && (
          <div className="h-32 animate-pulse rounded-xl bg-muted/80" />
        )}
        {isError && (
          <p className="text-sm text-destructive">Unable to load transactions.</p>
        )}
        {!isLoading && !isError && (
          <>
            <div className="app-scrollbar max-h-[360px] overflow-auto rounded-2xl border border-border/70 bg-card/72 shadow-[0_18px_40px_-30px_rgba(31,27,22,0.18)] dark:shadow-[0_20px_42px_-28px_rgba(1,4,9,0.7)]">
              {table.getRowModel().rows.length === 0 ? (
                <div className="flex h-48 items-center justify-center px-4 text-sm text-muted-foreground">
                  No transactions found for this range.
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/88 shadow-sm backdrop-blur">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="transition-colors odd:bg-transparent even:bg-black/[0.025] hover:bg-primary/[0.06] dark:even:bg-white/[0.025] dark:hover:bg-primary/[0.08]"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 text-foreground">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionsTable;
