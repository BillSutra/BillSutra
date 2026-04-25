"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bot, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/providers/LanguageProvider";
import { cn } from "@/lib/utils";
import {
  fetchInventories,
  fetchInvoices,
  fetchInventoryDemandPredictions,
  fetchSales,
  type Inventory,
  type InventoryDemandPrediction,
  type Invoice,
  type Sale,
} from "@/lib/apiClient";

type AssistantAction = {
  label: string;
  href: string;
};

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: AssistantAction[];
};

type InventoryInsightRow = Inventory & {
  prediction: InventoryDemandPrediction | null;
  effectiveStock: number;
  status: "urgent" | "low" | "ok";
};

type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;
type CurrencyFormatter = (value: number) => string;

const QUICK_ACTION_KEYS = [
  "stock",
  "restock",
  "todaySales",
  "lowStock",
  "topProduct",
] as const;

const createWelcomeMessage = (t: TranslateFn): AssistantMessage => ({
  id: "welcome",
  role: "assistant",
  text: t("assistantWidget.welcome"),
});

const getPredictionKey = (productId: number, warehouseId?: number | null) =>
  `${productId}:${warehouseId ?? "all"}`;

const normalizeText = (value: string) => value.trim().toLowerCase();
const humanizeQuickActionKey = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (segment) => segment.toUpperCase());

const buildBulkRestockHref = (rows: InventoryInsightRow[]) => {
  const params = new URLSearchParams();
  const uniqueWarehouseIds = Array.from(
    new Set(rows.map((row) => String(row.warehouse.id))),
  );

  if (uniqueWarehouseIds.length === 1) {
    params.set("warehouseId", uniqueWarehouseIds[0] ?? "");
  }

  params.set("source", "inventory_bulk_restock");
  params.set(
    "restockItems",
    JSON.stringify(
      rows.map((row) => ({
        productId: String(row.product.id),
        productLabel: row.product.sku
          ? `${row.product.name} - ${row.product.sku}`
          : row.product.name,
        quantity: String(
          row.prediction?.recommended_reorder_quantity ??
            row.product.reorder_level ??
            1,
        ),
        unitCost:
          row.prediction?.unit_cost !== undefined
            ? String(row.prediction.unit_cost)
            : "",
        warehouseId: String(row.warehouse.id),
      })),
    ),
  );

  return `/purchases/new?${params.toString()}`;
};

const formatDateKey = (value: string | Date) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildInventoryRows = (
  inventories: Inventory[],
  predictions: InventoryDemandPrediction[],
) => {
  const predictionMap = new Map<string, InventoryDemandPrediction>();

  predictions.forEach((prediction) => {
    predictionMap.set(
      getPredictionKey(prediction.product_id, prediction.warehouse_id),
      prediction,
    );
    if (prediction.warehouse_id == null) {
      predictionMap.set(getPredictionKey(prediction.product_id), prediction);
    }
  });

  return inventories
    .map((item) => {
      const prediction =
        predictionMap.get(getPredictionKey(item.product.id, item.warehouse.id)) ??
        predictionMap.get(getPredictionKey(item.product.id)) ??
        null;
      const effectiveStock = prediction?.stock_left ?? item.quantity;
      const reorderLevel = item.product.reorder_level ?? 0;
      const status =
        effectiveStock <= 0 || prediction?.alert_level === "critical"
          ? "urgent"
          : effectiveStock <= reorderLevel || prediction?.alert_level === "warning"
            ? "low"
            : "ok";

      return {
        ...item,
        prediction,
        effectiveStock,
        status,
      } satisfies InventoryInsightRow;
    })
    .sort((left, right) => {
      const priority = { urgent: 0, low: 1, ok: 2 };
      if (priority[left.status] !== priority[right.status]) {
        return priority[left.status] - priority[right.status];
      }
      return left.effectiveStock - right.effectiveStock;
    });
};

const buildAssistantReply = ({
  query,
  inventoryRows,
  sales,
  invoices,
  t,
  formatCurrency,
}: {
  query: string;
  inventoryRows: InventoryInsightRow[];
  sales: Sale[];
  invoices: Invoice[];
  t: TranslateFn;
  formatCurrency: CurrencyFormatter;
}): AssistantMessage => {
  const normalized = normalizeText(query);
  const urgentRows = inventoryRows.filter((row) => row.status === "urgent");
  const lowRows = inventoryRows.filter((row) => row.status === "low");
  const todayKey = formatDateKey(new Date());
  const todaySales = sales.filter((sale) => formatDateKey(sale.sale_date) === todayKey);
  const todaySalesTotal = todaySales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount ?? sale.total ?? 0),
    0,
  );

  const topSelling = sales
    .flatMap((sale) => sale.items)
    .reduce<Map<string, { name: string; quantity: number }>>((map, item) => {
      const key = String(item.product_id ?? item.name);
      const current = map.get(key) ?? { name: item.name, quantity: 0 };
      map.set(key, {
        name: current.name,
        quantity: current.quantity + Number(item.quantity ?? 0),
      });
      return map;
    }, new Map());

  const topSellingProduct = Array.from(topSelling.values()).sort(
    (left, right) => right.quantity - left.quantity,
  )[0];

  if (
    normalized.includes("restock") ||
    normalized.includes("low stock") ||
    normalized.includes("urgent") ||
    normalized.includes("dikhao") ||
    normalized.includes("रीस्टॉक") ||
    normalized.includes("कम स्टॉक") ||
    normalized.includes("तुरंत")
  ) {
    const itemsToShow = [...urgentRows, ...lowRows].slice(0, 4);
    if (itemsToShow.length === 0) {
      return {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: t("assistantWidget.responses.noUrgentRestock"),
        actions: [
          {
            label: t("assistantWidget.actions.viewInventory"),
            href: "/inventory",
          },
        ],
      };
    }

    return {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      text: t("assistantWidget.responses.restockIntro", {
        count: urgentRows.length + lowRows.length,
        items: itemsToShow
          .map((row) =>
            t(
              row.status === "urgent"
                ? "assistantWidget.responses.restockItemUrgent"
                : "assistantWidget.responses.restockItemLow",
              { name: row.product.name },
            ),
          )
          .join("\n"),
      }),
      actions: [
        {
          label: t("assistantWidget.actions.restockNow"),
          href: buildBulkRestockHref(itemsToShow),
        },
        {
          label: t("assistantWidget.actions.viewInventory"),
          href: "/inventory",
        },
      ],
    };
  }

  if (normalized.includes("stock") || normalized.includes("स्टॉक")) {
    return {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      text: t("assistantWidget.responses.stockSummary", {
        urgent: urgentRows.length,
        low: lowRows.length,
        healthy: inventoryRows.filter((row) => row.status === "ok").length,
      }),
      actions: [
        {
          label: t("assistantWidget.actions.viewInventory"),
          href: "/inventory",
        },
        ...(urgentRows.length + lowRows.length > 0
          ? [
              {
                label: t("assistantWidget.actions.restockNow"),
                href: buildBulkRestockHref(
                  [...urgentRows, ...lowRows].slice(0, 4),
                ),
              },
            ]
          : []),
      ],
    };
  }

  if (
    normalized.includes("aaj") ||
    normalized.includes("sale") ||
    normalized.includes("sales") ||
    normalized.includes("आज") ||
    normalized.includes("बिक्री")
  ) {
    return {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      text: t("assistantWidget.responses.todaySales", {
        amount: formatCurrency(todaySalesTotal),
        count: todaySales.length,
      }),
      actions: [{ label: t("assistantWidget.actions.openSales"), href: "/sales" }],
    };
  }

  if (
    normalized.includes("sabse zyada") ||
    normalized.includes("top product") ||
    normalized.includes("bikne") ||
    normalized.includes("सबसे ज़्यादा") ||
    normalized.includes("बिकने")
  ) {
    return {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      text: topSellingProduct
        ? t("assistantWidget.responses.topProduct", {
            name: topSellingProduct.name,
            count: topSellingProduct.quantity,
          })
        : t("assistantWidget.responses.topProductEmpty"),
      actions: [{ label: t("assistantWidget.actions.openSales"), href: "/sales" }],
    };
  }

  if (
    normalized.includes("bill") ||
    normalized.includes("invoice") ||
    normalized.includes("बिल") ||
    normalized.includes("इनवॉइस")
  ) {
    const latestInvoice = [...invoices].sort((left, right) =>
      new Date(right.date).getTime() - new Date(left.date).getTime(),
    )[0];

    return {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      text: latestInvoice
        ? t("assistantWidget.responses.latestBill", {
            number: latestInvoice.invoice_number,
          })
        : t("assistantWidget.responses.latestBillEmpty"),
      actions: [
        latestInvoice
          ? {
              label: t("assistantWidget.actions.openBill"),
              href: `/invoices/history/${latestInvoice.id}`,
            }
          : { label: t("assistantWidget.actions.openInvoices"), href: "/invoices" },
      ],
    };
  }

  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    text: t("assistantWidget.responses.fallback"),
    actions: [{ label: t("assistantWidget.actions.viewInventory"), href: "/inventory" }],
  };
};

const BillSutraAssistant = () => {
  const pathname = usePathname();
  const { language, t, safeT, formatCurrency } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    createWelcomeMessage(t),
  ]);
  const proactiveShownRef = useRef<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const quickActions = useMemo(
    () =>
      QUICK_ACTION_KEYS.map((key) => ({
        key,
        label: safeT(
          `assistantWidget.quickActions.${key}`,
          humanizeQuickActionKey(key),
        ),
      })),
    [safeT],
  );

  const { data: inventories = [], isFetching: inventoriesFetching } = useQuery({
    queryKey: ["assistant", "inventories"],
    queryFn: () => fetchInventories(),
    enabled: open,
    staleTime: 30_000,
  });

  const { data: predictions = { predictions: [] }, isFetching: predictionsFetching } =
    useQuery({
      queryKey: ["assistant", "inventory-predictions"],
      queryFn: () => fetchInventoryDemandPredictions({ limit: 200 }),
      enabled: open,
      staleTime: 30_000,
    });

  const { data: sales = [], isFetching: salesFetching } = useQuery({
    queryKey: ["assistant", "sales"],
    queryFn: () => fetchSales(),
    enabled: open,
    staleTime: 30_000,
  });

  const { data: invoices = [], isFetching: invoicesFetching } = useQuery({
    queryKey: ["assistant", "invoices"],
    queryFn: () => fetchInvoices(),
    enabled: open,
    staleTime: 30_000,
  });

  const inventoryRows = useMemo(
    () => buildInventoryRows(inventories, predictions.predictions ?? []),
    [inventories, predictions.predictions],
  );

  const loading = inventoriesFetching || predictionsFetching || salesFetching || invoicesFetching;

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    proactiveShownRef.current = null;
    setMessages([createWelcomeMessage(t)]);
  }, [language, t]);

  useEffect(() => {
    if (!open || pathname !== "/inventory") return;
    if (proactiveShownRef.current === pathname) return;
    if (inventoryRows.length === 0) return;

    const urgentCount = inventoryRows.filter((row) => row.status === "urgent").length;
    if (urgentCount === 0) return;

    proactiveShownRef.current = pathname;
    setMessages((current) => [
      ...current,
      {
        id: `proactive-${Date.now()}`,
        role: "assistant",
        text: t("assistantWidget.responses.proactiveUrgent", {
          count: urgentCount,
        }),
        actions: [
          { label: t("assistantWidget.actions.viewInventory"), href: "/inventory" },
          {
            label: t("assistantWidget.actions.restockNow"),
            href: buildBulkRestockHref(
              inventoryRows.filter((row) => row.status === "urgent").slice(0, 4),
            ),
          },
        ],
      },
    ]);
  }, [inventoryRows, open, pathname, t]);

  const submitQuery = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: query,
      },
    ]);

    if (loading && inventoryRows.length === 0 && sales.length === 0) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-loading-${Date.now()}`,
          role: "assistant",
          text: t("assistantWidget.loading"),
        },
      ]);
      setInput("");
      return;
    }

    const reply = buildAssistantReply({
      query,
      inventoryRows,
      sales,
      invoices,
      t,
      formatCurrency: (value) =>
        formatCurrency(value, "INR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
    });

    setMessages((current) => [...current, reply]);
    setInput("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuery(input);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      <div
        className={cn(
          "mb-3 origin-bottom-right transition-all duration-200",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <div className="flex h-[420px] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)]">
          <div className="flex items-start justify-between border-b border-gray-200 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {t("assistantWidget.title")}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t("assistantWidget.subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              aria-label={t("assistantWidget.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-gray-200 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => submitQuery(action.label)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-100"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[88%] rounded-2xl px-3 py-3 text-sm leading-6",
                  message.role === "assistant"
                    ? "bg-gray-100 text-gray-800"
                    : "ml-auto bg-gray-900 text-white",
                )}
              >
                <p className="whitespace-pre-line">{message.text}</p>
                {message.actions?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <Button
                        key={`${message.id}-${action.href}-${action.label}`}
                        asChild
                        size="sm"
                        variant={message.role === "assistant" ? "outline" : "secondary"}
                        className="h-8 rounded-md text-xs"
                      >
                        <Link href={action.href}>{action.label}</Link>
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="max-w-[88%] rounded-2xl bg-gray-100 px-3 py-3 text-sm text-gray-600">
                {t("assistantWidget.loading")}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t("assistantWidget.inputPlaceholder")}
                className="h-10 rounded-md border-gray-300"
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 rounded-md"
                disabled={!input.trim()}
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="group relative flex justify-end">
        {!open ? (
          <div className="pointer-events-none absolute bottom-full right-0 mb-2 rounded-md bg-gray-900 px-3 py-2 text-xs text-white opacity-0 transition group-hover:opacity-100">
            {t("assistantWidget.tooltip")}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "group flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-[0_12px_30px_-22px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-gray-300",
            !open && "animate-[pulse_3s_ease-in-out_infinite]",
          )}
          aria-label={t("assistantWidget.toggle")}
        >
          {open ? (
            <X className="h-4 w-4" />
          ) : (
            <>
              <span className="rounded-full bg-gray-900 p-2 text-white">
                <Bot className="h-4 w-4" />
              </span>
              <span className="hidden sm:inline">{t("assistantWidget.toggle")}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default BillSutraAssistant;
