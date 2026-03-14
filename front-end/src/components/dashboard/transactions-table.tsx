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
    <Card className="rounded-xl border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <CardHeader>
        <CardTitle className="text-lg">Recent transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />
        )}
        {isError && (
          <p className="text-sm text-red-600">Unable to load transactions.</p>
        )}
        {!isLoading && !isError && (
          <>
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-700/50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left font-semibold"
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
                      className="transition-colors odd:bg-white even:bg-gray-50/70 hover:bg-indigo-50/60 dark:odd:bg-gray-800 dark:even:bg-gray-800/70 dark:hover:bg-indigo-500/10"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
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
              <p className="text-sm text-gray-500">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
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
