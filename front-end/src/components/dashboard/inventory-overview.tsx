"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardInventory } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const InventoryOverview = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "inventory"],
    queryFn: fetchDashboardInventory,
  });

  return (
    <Card className="border-[#ecdccf] bg-white/90">
      <CardHeader>
        <CardTitle className="text-lg">Inventory overview</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        {isLoading && (
          <div className="h-32 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">Unable to load inventory.</p>
        )}
        {!isLoading && !isError && data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total products", value: data.totalProducts },
                { label: "Low stock", value: data.lowStock },
                { label: "Out of stock", value: data.outOfStock },
                {
                  label: "Inventory value",
                  value: formatCurrency(data.inventoryValue),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-[#1f1b16]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {data.lowStock > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Low stock warning</p>
                  <Badge variant="pending">Action needed</Badge>
                </div>
                <p className="mt-1 text-xs">
                  {data.lowStock} products are below their minimum stock level.
                </p>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Low stock products
              </p>
              {data.lowStockItems.length === 0 ? (
                <p className="mt-3 text-sm text-[#8a6d56]">
                  No low stock items.
                </p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-xl border border-[#f2e6dc]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#fff7ef]">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">
                          Product
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Stock
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Reorder level
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f2e6dc]">
                      {data.lowStockItems.map((item) => (
                        <tr key={`${item.name}-${item.reorder}`}>
                          <td className="px-4 py-3">{item.name}</td>
                          <td className="px-4 py-3 text-right">{item.stock}</td>
                          <td className="px-4 py-3 text-right">
                            {item.reorder}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryOverview;
