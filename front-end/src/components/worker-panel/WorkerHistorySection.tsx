"use client";

import React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ReceiptText, Search } from "lucide-react";
import FriendlyEmptyState from "@/components/ui/FriendlyEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchWorkerHistory,
  type WorkerHistoryEntry,
} from "@/lib/apiClient";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const getStatusBadgeVariant = (status: string): "paid" | "pending" | "overdue" => {
  const normalized = status.toUpperCase();
  if (normalized === "PAID") return "paid";
  if (normalized === "PARTIALLY_PAID") return "overdue";
  return "pending";
};

const getStatusLabel = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized === "PARTIALLY_PAID") return "Partial";
  if (normalized === "PAID") return "Paid";
  return "Pending";
};

const TableSkeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-border/80">
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            {["Reference", "Type", "Date", "Customer", "Amount", "Status"].map(
              (label) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, index) => (
            <tr key={index} className="border-t border-border/70">
              {Array.from({ length: 6 }).map((__, cellIndex) => (
                <td key={cellIndex} className="px-4 py-4">
                  <div className="h-5 animate-pulse rounded bg-muted" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const HistoryTable = ({
  entries,
}: {
  entries: WorkerHistoryEntry[];
}) => (
  <div className="overflow-hidden rounded-2xl border border-border/80">
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-foreground">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Reference</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={`${entry.type}-${entry.id}`}
              className={cn(
                "border-t border-border/70 transition-colors hover:bg-accent/40",
                index % 2 === 0 ? "bg-background" : "bg-muted/10",
              )}
            >
              <td className="px-4 py-4">
                <div className="font-semibold">{entry.reference}</div>
              </td>
              <td className="px-4 py-4">
                <Badge className="rounded-full border-border/70 bg-muted/60 text-foreground">
                  {entry.type === "INVOICE" ? "Invoice" : "Sale"}
                </Badge>
              </td>
              <td className="px-4 py-4 text-muted-foreground">
                {formatDate(entry.date)}
              </td>
              <td className="px-4 py-4">
                {entry.customerName?.trim() || "Walk-in Customer"}
              </td>
              <td className="px-4 py-4 text-right font-semibold">
                {formatCurrency(entry.amount)}
              </td>
              <td className="px-4 py-4 text-right">
                <Badge variant={getStatusBadgeVariant(entry.status)}>
                  {getStatusLabel(entry.status)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const WorkerHistorySection = () => {
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [minAmount, setMinAmount] = React.useState("");
  const [maxAmount, setMaxAmount] = React.useState("");

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, startDate, endDate, minAmount, maxAmount]);

  const filterError = React.useMemo(() => {
    if (startDate && endDate && startDate > endDate) {
      return "Start date cannot be after end date.";
    }

    if (
      minAmount &&
      maxAmount &&
      Number(minAmount) > Number(maxAmount)
    ) {
      return "Minimum amount cannot be greater than maximum amount.";
    }

    return null;
  }, [endDate, maxAmount, minAmount, startDate]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "worker",
      "dashboard",
      "history",
      currentPage,
      debouncedSearch,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    ],
    queryFn: () =>
      fetchWorkerHistory({
        page: currentPage,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minAmount: minAmount || undefined,
        maxAmount: maxAmount || undefined,
      }),
    enabled: !filterError,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (isError) {
      toast.error("Unable to load work history right now.");
    }
  }, [isError]);

  React.useEffect(() => {
    if (data?.totalPages && currentPage > data.totalPages) {
      setCurrentPage(data.totalPages);
    }
  }, [currentPage, data?.totalPages]);

  const entries = data?.entries ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalEntries = data?.total ?? 0;
  const showingFrom =
    totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, totalEntries);

  const clearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setStartDate("");
    setEndDate("");
    setMinAmount("");
    setMaxAmount("");
    setCurrentPage(1);
  };

  return (
    <Card className="transition-shadow duration-200">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" />
              Work History
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Review invoices and sales activity assigned to you.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Worker-only history
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by customer name"
                className="pl-9"
              />
            </div>
          </div>

          <Input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            aria-label="Start date"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            aria-label="End date"
          />

          <div className="flex gap-3 xl:col-span-1">
            <Input
              type="number"
              min="0"
              value={minAmount}
              onChange={(event) => setMinAmount(event.target.value)}
              placeholder="Min amount"
              aria-label="Minimum amount"
            />
            <Input
              type="number"
              min="0"
              value={maxAmount}
              onChange={(event) => setMaxAmount(event.target.value)}
              placeholder="Max amount"
              aria-label="Maximum amount"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {filterError ? (
              <span className="text-destructive">{filterError}</span>
            ) : (
              <>
                Showing {showingFrom}-{showingTo} of {totalEntries} entries
                {isFetching ? " - Updating..." : ""}
              </>
            )}
          </div>

          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        {isLoading ? <TableSkeleton /> : null}

        {!isLoading && isError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Work history could not be loaded. Please try again in a moment.
          </div>
        ) : null}

        {!isLoading && !filterError && !isError && entries.length === 0 ? (
          <FriendlyEmptyState
            icon={ReceiptText}
            title="No work history yet"
            description="Your assigned invoices and sales will appear here once activity starts."
            hint="Try clearing filters if you expected to see older entries."
          />
        ) : null}

        {!isLoading && !filterError && entries.length > 0 ? (
          <>
            <HistoryTable entries={entries} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {Math.max(totalPages, 1)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentPage <= 1 || isFetching}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(Math.max(totalPages, 1), page + 1),
                    )
                  }
                  disabled={currentPage >= totalPages || isFetching}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default WorkerHistorySection;
