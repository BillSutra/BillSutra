"use client";

import React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardTransactions } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceiptText } from "lucide-react";

type TransactionRow = {
  date: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  paymentStatus: "PAID" | "PARTIAL" | "PENDING";
};

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const columns: ColumnDef<TransactionRow>[] = [
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
    cell: ({ row }) => formatCurrency(row.original.amount),
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

const TransactionsTable = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "transactions"],
    queryFn: fetchDashboardTransactions,
  });

  const table = useReactTable({
    data: data?.transactions ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <Card className="dashboard-chart-surface gap-0 py-6 rounded-[1.75rem]">
      <CardHeader className="dashboard-chart-content gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#f2e6dc] bg-white/80 p-2 text-[#8b5e34]">
            <ReceiptText size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#8a6d56]">
              Ledger snapshot
            </p>
            <CardTitle className="mt-1 text-lg text-[#1f1b16]">
              Recent transactions
            </CardTitle>
          </div>
        </div>
        <p className="text-sm text-[#8a6d56]">
          Track the latest invoices and payment status at a glance.
        </p>
      </CardHeader>
      <CardContent className="dashboard-chart-content">
        {isLoading && (
          <div className="h-32 animate-pulse rounded-xl bg-[#fdf7f1] dark:bg-gray-700" />
        )}
        {isError && (
          <p className="text-sm text-red-600">Unable to load transactions.</p>
        )}
        {!isLoading && !isError && (
          <>
            <div className="overflow-hidden rounded-2xl border border-[#ecdccf] bg-white/85 shadow-[0_18px_40px_-30px_rgba(31,27,22,0.3)] dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-[#fff5ea] dark:bg-gray-700/50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d56]"
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
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="transition-colors odd:bg-white even:bg-[#fffaf5] hover:bg-[#f6efe6] dark:odd:bg-gray-800 dark:even:bg-gray-800/70 dark:hover:bg-indigo-500/10"
                      >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 text-[#4b3a2a]">
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
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-[#8a6d56]">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl border-[#ecdccf] bg-white/85"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-[#ecdccf] bg-white/85"
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
