"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Barcode,
  CheckCircle2,
  Clock3,
  PackagePlus,
  Plus,
  ReceiptText,
  ScanLine,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCategoriesQuery,
  useCreateCustomerMutation,
  useCreateProductMutation,
} from "@/hooks/useInventoryQueries";
import { invalidateDashboardQueries } from "@/lib/dashboardRealtime";
import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/LanguageProvider";
import FirstTimeHint from "@/components/ui/FirstTimeHint";

const QUICK_ACTION_USAGE_KEY = "billsutra.quick-actions.usage.v1";
const QUICK_ACTION_RECENT_KEY = "billsutra.quick-actions.recent.v1";
const QUICK_ACTION_DEFAULTS_KEY = "billsutra.quick-actions.defaults.v1";

type QuickActionId = "add-product" | "new-bill" | "add-customer";

type QuickActionUsage = Record<QuickActionId, number>;

type QuickActionDefaults = {
  product: {
    price: string;
    categoryId: string;
  };
  customer: {
    phone: string;
  };
};

type QuickActionRecentItem = {
  id: string;
  actionId: QuickActionId;
  label: string;
  meta: string;
  timestamp: number;
};

type ProductQuickForm = {
  name: string;
  price: string;
  barcode: string;
  categoryId: string;
};

type CustomerQuickForm = {
  name: string;
  phone: string;
};

const DEFAULT_USAGE: QuickActionUsage = {
  "add-product": 0,
  "new-bill": 0,
  "add-customer": 0,
};

const DEFAULT_DEFAULTS: QuickActionDefaults = {
  product: {
    price: "",
    categoryId: "",
  },
  customer: {
    phone: "",
  },
};

const readStoredJson = <T,>(key: string, fallback: T) => {
  if (typeof window === "undefined") return fallback;

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return fallback;
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
};

const writeStoredJson = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write failures in restricted browser contexts.
  }
};

const buildProductSku = (name: string, barcode: string) => {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  const suffix =
    barcode.trim().replace(/\D+/g, "").slice(-4) ||
    Date.now().toString().slice(-4);

  return `${base || "ITEM"}-${suffix}`;
};

const formatRecentTime = (
  timestamp: number,
  t: (key: string, params?: Record<string, string | number>) => string,
) => {
  const elapsedMs = Date.now() - timestamp;
  const minutes = Math.floor(elapsedMs / 60000);

  if (minutes < 1) return t("time.justNow");
  if (minutes < 60) return t("time.minutesAgo", { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });

  const days = Math.floor(hours / 24);
  return t("time.daysAgo", { count: days });
};

const getMutationErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: Record<string, string[] | string> }
      | undefined;
    const messages = new Set<string>();

    if (data?.message) messages.add(data.message);

    if (data?.errors) {
      Object.values(data.errors).forEach((value) => {
        const list = Array.isArray(value) ? value : [value];
        list.forEach((item) => messages.add(item));
      });
    }

    if (messages.size > 0) {
      return Array.from(messages).join(" ");
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const playSuccessFeedback = () => {
  if (typeof window === "undefined") return;

  if ("vibrate" in navigator) {
    navigator.vibrate([20, 16, 28]);
  }

  try {
    const audioContext = new window.AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      1320,
      audioContext.currentTime + 0.08,
    );
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.045,
      audioContext.currentTime + 0.015,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + 0.16,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.16);

    window.setTimeout(() => {
      void audioContext.close();
    }, 240);
  } catch {
    // Audio feedback is optional.
  }
};

const productActionTone =
  "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(209,250,229,0.9))] text-emerald-950 hover:border-emerald-300 hover:shadow-[0_22px_40px_-30px_rgba(5,150,105,0.55)] dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100";
const billActionTone =
  "border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(254,243,199,0.92))] text-amber-950 hover:border-amber-300 hover:shadow-[0_22px_40px_-30px_rgba(217,119,6,0.55)] dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100";
const customerActionTone =
  "border-sky-200/80 bg-[linear-gradient(180deg,rgba(240,249,255,0.96),rgba(224,242,254,0.92))] text-sky-950 hover:border-sky-300 hover:shadow-[0_22px_40px_-30px_rgba(2,132,199,0.55)] dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100";

const actionDetails = [
  {
    id: "add-product" as const,
    label: "Add Product",
    description: "Name, price, and barcode-ready entry.",
    meta: "SKU is generated automatically",
    icon: PackagePlus,
    toneClassName: productActionTone,
  },
  {
    id: "new-bill" as const,
    label: "New Bill",
    description: "Launch billing with product search focused.",
    meta: "Barcode and keyboard input ready",
    icon: ReceiptText,
    toneClassName: billActionTone,
  },
  {
    id: "add-customer" as const,
    label: "Add Customer",
    description: "Capture name and phone in a tiny form.",
    meta: "Save in one or two taps",
    icon: UserRoundPlus,
    toneClassName: customerActionTone,
  },
];

const QuickActions = ({ className }: { className?: string }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { language, t, formatNumber } = useI18n();
  const { data: categories = [] } = useCategoriesQuery();
  const createProduct = useCreateProductMutation();
  const createCustomer = useCreateCustomerMutation();
  const productNameRef = useRef<HTMLInputElement | null>(null);
  const productBarcodeRef = useRef<HTMLInputElement | null>(null);
  const customerNameRef = useRef<HTMLInputElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const successBannerTimerRef = useRef<number | null>(null);

  const [usage, setUsage] = useState<QuickActionUsage>(DEFAULT_USAGE);
  const [recentActions, setRecentActions] = useState<QuickActionRecentItem[]>(
    [],
  );
  const [defaults, setDefaults] =
    useState<QuickActionDefaults>(DEFAULT_DEFAULTS);
  const [activeAction, setActiveAction] = useState<QuickActionId | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [pressedAction, setPressedAction] = useState<QuickActionId | null>(
    null,
  );
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductQuickForm>({
    name: "",
    price: "",
    barcode: "",
    categoryId: "",
  });
  const [customerForm, setCustomerForm] = useState<CustomerQuickForm>({
    name: "",
    phone: "",
  });

  useEffect(() => {
    const storedDefaults = readStoredJson<QuickActionDefaults>(
      QUICK_ACTION_DEFAULTS_KEY,
      DEFAULT_DEFAULTS,
    );

    setUsage({
      ...DEFAULT_USAGE,
      ...readStoredJson<Partial<QuickActionUsage>>(
        QUICK_ACTION_USAGE_KEY,
        DEFAULT_USAGE,
      ),
    });
    setRecentActions(
      readStoredJson<QuickActionRecentItem[]>(
        QUICK_ACTION_RECENT_KEY,
        [],
      ).slice(0, 6),
    );
    setDefaults({
      product: {
        ...DEFAULT_DEFAULTS.product,
        ...storedDefaults.product,
      },
      customer: {
        ...DEFAULT_DEFAULTS.customer,
        ...storedDefaults.customer,
      },
    });
  }, []);

  useEffect(() => {
    if (activeAction === "add-product") {
      setProductForm({
        name: "",
        price: defaults.product.price,
        barcode: "",
        categoryId: defaults.product.categoryId,
      });
    }

    if (activeAction === "add-customer") {
      setCustomerForm({
        name: "",
        phone: defaults.customer.phone,
      });
    }
  }, [activeAction, defaults]);

  useEffect(() => {
    if (activeAction !== "add-product") return;

    const timeoutId = window.setTimeout(() => {
      productNameRef.current?.focus();
      productNameRef.current?.select();
    }, 170);

    return () => window.clearTimeout(timeoutId);
  }, [activeAction]);

  useEffect(() => {
    if (activeAction !== "add-customer") return;

    const timeoutId = window.setTimeout(() => {
      customerNameRef.current?.focus();
      customerNameRef.current?.select();
    }, 170);

    return () => window.clearTimeout(timeoutId);
  }, [activeAction]);

  useEffect(() => {
    return () => {
      if (successBannerTimerRef.current) {
        window.clearTimeout(successBannerTimerRef.current);
      }
    };
  }, []);

  const orderedActions = useMemo(() => {
    return [...actionDetails].sort((left, right) => {
      const usageDifference = usage[right.id] - usage[left.id];
      if (usageDifference !== 0) return usageDifference;

      return (
        actionDetails.findIndex((item) => item.id === left.id) -
        actionDetails.findIndex((item) => item.id === right.id)
      );
    });
  }, [usage]);

  const actionLabelMap: Record<QuickActionId, string> = {
    "add-product": t("dashboardQuickDesk.actions.addProduct.label"),
    "new-bill": t("dashboardQuickDesk.actions.newBill.label"),
    "add-customer": t("dashboardQuickDesk.actions.addCustomer.label"),
  };

  const mostUsedActionLabel = orderedActions[0]
    ? actionLabelMap[orderedActions[0].id]
    : t("dashboardQuickDesk.title");
  const recentProducts = recentActions.filter(
    (item) => item.actionId === "add-product",
  );
  const recentCustomers = recentActions.filter(
    (item) => item.actionId === "add-customer",
  );

  const persistUsage = (actionId: QuickActionId) => {
    setUsage((currentUsage) => {
      const nextUsage = {
        ...currentUsage,
        [actionId]: currentUsage[actionId] + 1,
      };
      writeStoredJson(QUICK_ACTION_USAGE_KEY, nextUsage);
      return nextUsage;
    });
  };

  const pushRecentAction = (
    actionId: QuickActionId,
    label: string,
    meta: string,
  ) => {
    setRecentActions((currentRecentActions) => {
      const nextRecentActions = [
        {
          id: `${actionId}-${Date.now()}`,
          actionId,
          label,
          meta,
          timestamp: Date.now(),
        },
        ...currentRecentActions,
      ].slice(0, 6);

      writeStoredJson(QUICK_ACTION_RECENT_KEY, nextRecentActions);
      return nextRecentActions;
    });
  };

  const setSuccessState = (message: string) => {
    setSuccessBanner(message);

    if (successBannerTimerRef.current) {
      window.clearTimeout(successBannerTimerRef.current);
    }

    successBannerTimerRef.current = window.setTimeout(() => {
      setSuccessBanner(null);
    }, 2400);
  };

  const handleActionPress = (actionId: QuickActionId) => {
    setPressedAction(actionId);
    window.setTimeout(() => setPressedAction(null), 420);
    persistUsage(actionId);
    setFabOpen(false);

    if (actionId === "new-bill") {
      pushRecentAction(
        "new-bill",
        t("dashboardQuickDesk.actions.newBill.label"),
        t("dashboardQuickDesk.actions.newBill.meta"),
      );
      setSuccessState(t("dashboardQuickDesk.messages.newBillOpened"));
      toast.success(t("dashboardQuickDesk.messages.newBillReady"), {
        description: t("dashboardQuickDesk.messages.newBillDescription"),
      });
      playSuccessFeedback();
      router.push("/simple-bill");
      return;
    }

    setActiveAction(actionId);
  };

  const handleProductSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const trimmedName = productForm.name.trim();
    const trimmedPrice = productForm.price.trim();
    const trimmedBarcode = productForm.barcode.trim();

    if (!trimmedName) {
      toast.error(t("dashboardQuickDesk.messages.enterProductName"));
      productNameRef.current?.focus();
      return;
    }

    if (
      !trimmedPrice ||
      Number.isNaN(Number(trimmedPrice)) ||
      Number(trimmedPrice) < 0
    ) {
      toast.error(t("dashboardQuickDesk.messages.enterValidPrice"));
      return;
    }

    try {
      const createdProduct = await createProduct.mutateAsync({
        name: trimmedName,
        sku: buildProductSku(trimmedName, trimmedBarcode),
        price: Number(trimmedPrice),
        barcode: trimmedBarcode || undefined,
        gst_rate: 18,
        stock_on_hand: 0,
        reorder_level: 0,
        category_id: productForm.categoryId
          ? Number(productForm.categoryId)
          : undefined,
      });

      await invalidateDashboardQueries(queryClient);

      const nextDefaults: QuickActionDefaults = {
        product: {
          price: trimmedPrice,
          categoryId: productForm.categoryId,
        },
        customer: defaults.customer,
      };

      setDefaults(nextDefaults);
      writeStoredJson(QUICK_ACTION_DEFAULTS_KEY, nextDefaults);
      pushRecentAction(
        "add-product",
        createdProduct.name,
        trimmedBarcode
          ? `${t("dashboardQuickDesk.productModal.barcode")}: ${trimmedBarcode}`
          : `${t("dashboardQuickDesk.productModal.price")}: ${trimmedPrice}`,
      );
      setSuccessState(t("dashboardQuickDesk.messages.productSaved"));
      playSuccessFeedback();
      toast.success(t("dashboardQuickDesk.messages.productAdded"), {
        description: trimmedBarcode
          ? t("dashboardQuickDesk.messages.productAddedBarcode")
          : t("dashboardQuickDesk.messages.productAddedSku"),
      });
      setActiveAction(null);
    } catch (error) {
      toast.error(
        getMutationErrorMessage(
          error,
          t("dashboardQuickDesk.messages.productError"),
        ),
      );
    }
  };

  const handleCustomerSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const trimmedName = customerForm.name.trim();
    const trimmedPhone = customerForm.phone.trim();

    if (!trimmedName) {
      toast.error(t("dashboardQuickDesk.messages.enterCustomerName"));
      customerNameRef.current?.focus();
      return;
    }

    if (trimmedPhone && !/^\d{10,15}$/.test(trimmedPhone)) {
      toast.error(t("dashboardQuickDesk.messages.enterValidPhone"));
      return;
    }

    try {
      const createdCustomer = await createCustomer.mutateAsync({
        name: trimmedName,
        phone: trimmedPhone || undefined,
      });

      await invalidateDashboardQueries(queryClient);

      const nextDefaults: QuickActionDefaults = {
        product: defaults.product,
        customer: {
          phone: trimmedPhone,
        },
      };

      setDefaults(nextDefaults);
      writeStoredJson(QUICK_ACTION_DEFAULTS_KEY, nextDefaults);
      pushRecentAction(
        "add-customer",
        createdCustomer.name,
        trimmedPhone || t("dashboardQuickDesk.notSet"),
      );
      setSuccessState(t("dashboardQuickDesk.messages.customerSaved"));
      playSuccessFeedback();
      toast.success(t("dashboardQuickDesk.messages.customerAdded"), {
        description: trimmedPhone
          ? t("dashboardQuickDesk.messages.customerAddedPhone")
          : t("dashboardQuickDesk.messages.customerAddedMinimal"),
      });
      setActiveAction(null);
    } catch (error) {
      toast.error(
        getMutationErrorMessage(
          error,
          t("dashboardQuickDesk.messages.customerError"),
        ),
      );
    }
  };

  const modalContentClassName =
    "top-auto right-0 bottom-0 left-0 max-h-[92vh] max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-t-[1.9rem] rounded-b-none border-border/80 bg-background/98 p-0 sm:top-[50%] sm:right-auto sm:bottom-auto sm:left-[50%] sm:max-w-xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.75rem]";

  const quickStartCopy =
    language === "hi"
      ? {
          heading: "शुरू करने के लिए सबसे आसान काम",
          description: "अगर आप नए हैं, तो पहले यही तीन बटन इस्तेमाल करें।",
          createBill: "बिल बनाएं",
          addProduct: "प्रोडक्ट जोड़ें",
          viewReports: "रिपोर्ट देखें",
          billHint: "यहीं से ग्राहक चुनकर पहला बिल बनता है।",
          productHint: "जो सामान आप बेचते हैं, उसे यहां जोड़ें।",
          reportsHint: "बिक्री और कमाई की आसान झलक यहां मिलेगी।",
        }
      : {
          heading: "Start with these simple actions",
          description: "If you are new, use these three buttons first.",
          createBill: "Create Bill",
          addProduct: "Add Product",
          viewReports: "View Reports",
          billHint: "Use this to choose a customer and create your first bill.",
          productHint: "Use this to add items you sell.",
          reportsHint: "Use this to quickly check sales and earnings.",
        };

  return (
    <>
      <Card
        className={cn(
          "dashboard-chart-surface h-fit self-start gap-0 rounded-[1.75rem] py-6",
          className,
        )}
      >
        <CardHeader className="dashboard-chart-content gap-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-border/70 bg-card/80 p-2 text-primary shadow-sm">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="app-kicker">{t("dashboardQuickDesk.kicker")}</p>
                  <CardTitle className="mt-1 text-lg text-foreground">
                    {t("dashboardQuickDesk.title")}
                  </CardTitle>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("dashboardQuickDesk.description")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-chip">
                {t("dashboardQuickDesk.mostUsed", {
                  label: mostUsedActionLabel,
                })}
              </span>
              <span className="app-chip">
                {t("dashboardQuickDesk.swipeUp")}
              </span>
            </div>
          </div>

          {successBanner ? (
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 animate-in fade-in zoom-in-95 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
              <CheckCircle2 size={16} />
              <span>{successBanner}</span>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="dashboard-chart-content space-y-4">
          <section className="rounded-[1.4rem] border border-border/70 bg-card/70 p-4 shadow-[0_14px_34px_-26px_rgba(31,27,22,0.2)]">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">
                {quickStartCopy.heading}
              </p>
              <p className="text-sm text-muted-foreground">
                {quickStartCopy.description}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <FirstTimeHint
                id="dashboard-create-bill"
                message={quickStartCopy.billHint}
                className="w-full"
              >
                <Button
                  type="button"
                  className="h-12 w-full justify-between rounded-[1rem] text-base font-semibold"
                  onClick={() => handleActionPress("new-bill")}
                >
                  {quickStartCopy.createBill}
                  <ArrowRight size={16} />
                </Button>
              </FirstTimeHint>

              <FirstTimeHint
                id="dashboard-add-product"
                message={quickStartCopy.productHint}
                className="w-full"
              >
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full justify-between rounded-[1rem] text-base font-semibold"
                  onClick={() => handleActionPress("add-product")}
                >
                  {quickStartCopy.addProduct}
                  <ArrowRight size={16} />
                </Button>
              </FirstTimeHint>

              <FirstTimeHint
                id="dashboard-view-reports"
                message={quickStartCopy.reportsHint}
                className="w-full"
              >
                <Button
                  asChild
                  variant="outline"
                  className="h-12 w-full justify-between rounded-[1rem] text-base font-semibold"
                >
                  <Link href="/insights">
                    {quickStartCopy.viewReports}
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              </FirstTimeHint>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-3">
            {orderedActions.map((action) => {
              const Icon = action.icon;
              const isPressed = pressedAction === action.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleActionPress(action.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-[1.5rem] border p-4 text-left transition duration-200 hover:-translate-y-1",
                    action.toneClassName,
                    isPressed && "scale-[0.98]",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-white/35 opacity-0",
                      isPressed && "animate-ping opacity-100",
                    )}
                  />
                  <div className="relative flex h-full items-start justify-between gap-4">
                    <div className="min-w-0 space-y-3">
                      <div className="inline-flex rounded-2xl border border-current/15 bg-white/55 p-3 shadow-sm dark:bg-white/10">
                        <Icon size={20} />
                      </div>
                      <div>
                        <p className="text-base font-semibold">
                          {actionLabelMap[action.id]}
                        </p>
                        <p className="mt-1 text-sm opacity-80">
                          {action.id === "add-product"
                            ? t(
                                "dashboardQuickDesk.actions.addProduct.description",
                              )
                            : action.id === "new-bill"
                              ? t(
                                  "dashboardQuickDesk.actions.newBill.description",
                                )
                              : t(
                                  "dashboardQuickDesk.actions.addCustomer.description",
                                )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] opacity-70">
                        <span>
                          {action.id === "add-product"
                            ? t("dashboardQuickDesk.actions.addProduct.meta")
                            : action.id === "new-bill"
                              ? t("dashboardQuickDesk.actions.newBill.meta")
                              : t(
                                  "dashboardQuickDesk.actions.addCustomer.meta",
                                )}
                        </span>
                        <span className="rounded-full border border-current/15 px-2 py-1">
                          {usage[action.id] > 0
                            ? t("dashboardQuickDesk.usage.taps", {
                                count: formatNumber(usage[action.id]),
                              })
                            : t("dashboardQuickDesk.usage.ready")}
                        </span>
                      </div>
                    </div>
                    <ArrowRight
                      size={16}
                      className="mt-1 shrink-0 transition-transform group-hover:translate-x-1"
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[1.4rem] border border-border/70 bg-card/70 p-4 shadow-[0_14px_34px_-26px_rgba(31,27,22,0.2)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock3 size={16} />
                <span>{t("dashboardQuickDesk.recentActions")}</span>
              </div>
              {recentActions.length > 0 ? (
                <div className="mt-4 grid gap-3">
                  {recentActions.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background/75 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.meta}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {formatRecentTime(item.timestamp, t)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {t("dashboardQuickDesk.recentEmpty")}
                </p>
              )}
            </section>

            <section className="rounded-[1.4rem] border border-border/70 bg-card/70 p-4 shadow-[0_14px_34px_-26px_rgba(31,27,22,0.2)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ScanLine size={16} />
                <span>{t("dashboardQuickDesk.smartDefaults")}</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70">
                    {t("dashboardQuickDesk.productSection")}
                  </p>
                  <p className="mt-2">
                    {t("dashboardQuickDesk.lastPrice", {
                      value:
                        defaults.product.price ||
                        t("dashboardQuickDesk.notSet"),
                    })}
                  </p>
                  <p className="mt-1">
                    {t("dashboardQuickDesk.lastCategory", {
                      value:
                        categories.find(
                          (category) =>
                            String(category.id) === defaults.product.categoryId,
                        )?.name ?? t("dashboardQuickDesk.noCategoryDefault"),
                    })}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70">
                    {t("dashboardQuickDesk.customerSection")}
                  </p>
                  <p className="mt-2">
                    {t("dashboardQuickDesk.lastPhone", {
                      value:
                        defaults.customer.phone ||
                        t("dashboardQuickDesk.notSet"),
                    })}
                  </p>
                  <p className="mt-1">
                    {t("dashboardQuickDesk.recentCounts", {
                      products: formatNumber(recentProducts.length),
                      customers: formatNumber(recentCustomers.length),
                    })}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>

      <div className="fixed right-4 bottom-5 z-40 sm:hidden">
        <div
          className="flex flex-col items-end gap-3"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(event) => {
            const initialTouch = touchStartRef.current;
            const touch = event.changedTouches[0];
            touchStartRef.current = null;

            if (!initialTouch) return;

            const deltaX = touch.clientX - initialTouch.x;
            const deltaY = touch.clientY - initialTouch.y;

            if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -48) {
              setFabOpen(true);
            }

            if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 48) {
              setFabOpen(false);
            }
          }}
        >
          <div
            className={cn(
              "flex flex-col items-end gap-2 transition duration-200",
              fabOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-3 opacity-0",
            )}
          >
            {orderedActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={`fab-${action.id}`}
                  type="button"
                  onClick={() => handleActionPress(action.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur",
                    action.toneClassName,
                  )}
                >
                  <Icon size={16} />
                  <span>{actionLabelMap[action.id]}</span>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            size="icon-lg"
            className={cn(
              "rounded-full bg-[#1f1b16] text-white shadow-[0_22px_50px_-24px_rgba(31,27,22,0.55)] hover:bg-[#2b251f]",
              fabOpen && "scale-105",
            )}
            onClick={() => setFabOpen((currentOpen) => !currentOpen)}
            aria-label={t("dashboardQuickDesk.toggleAria")}
          >
            <Plus
              size={22}
              className={cn(
                "transition-transform duration-200",
                fabOpen && "rotate-45",
              )}
            />
          </Button>
        </div>
      </div>

      <Modal
        open={activeAction === "add-product"}
        onOpenChange={(open) => setActiveAction(open ? "add-product" : null)}
        title={t("dashboardQuickDesk.productModal.title")}
        description={t("dashboardQuickDesk.productModal.description")}
        contentClassName={modalContentClassName}
      >
        <form
          className="grid gap-5 p-6"
          onSubmit={handleProductSubmit}
          noValidate
        >
          <div className="rounded-[1.4rem] border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
            {t("dashboardQuickDesk.productModal.hint")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="quick-product-name">
                {t("dashboardQuickDesk.productModal.name")}
              </Label>
              <Input
                ref={productNameRef}
                id="quick-product-name"
                value={productForm.name}
                onChange={(event) =>
                  setProductForm((currentForm) => ({
                    ...currentForm,
                    name: event.target.value,
                  }))
                }
                placeholder={t(
                  "dashboardQuickDesk.productModal.namePlaceholder",
                )}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quick-product-price">
                {t("dashboardQuickDesk.productModal.price")}
              </Label>
              <Input
                id="quick-product-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={productForm.price}
                onChange={(event) =>
                  setProductForm((currentForm) => ({
                    ...currentForm,
                    price: event.target.value,
                  }))
                }
                placeholder={t(
                  "dashboardQuickDesk.productModal.pricePlaceholder",
                )}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="quick-product-barcode">
                  {t("dashboardQuickDesk.productModal.barcode")}
                </Label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
                  onClick={() => productBarcodeRef.current?.focus()}
                >
                  <Barcode size={14} />
                  <span>{t("dashboardQuickDesk.productModal.scanNext")}</span>
                </button>
              </div>
              <Input
                ref={productBarcodeRef}
                id="quick-product-barcode"
                value={productForm.barcode}
                onChange={(event) =>
                  setProductForm((currentForm) => ({
                    ...currentForm,
                    barcode: event.target.value,
                  }))
                }
                placeholder={t(
                  "dashboardQuickDesk.productModal.barcodePlaceholder",
                )}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="quick-product-category">
                {t("dashboardQuickDesk.productModal.category")}
              </Label>
              <select
                id="quick-product-category"
                className="app-field h-10 px-3 text-sm text-foreground"
                value={productForm.categoryId}
                onChange={(event) =>
                  setProductForm((currentForm) => ({
                    ...currentForm,
                    categoryId: event.target.value,
                  }))
                }
              >
                <option value="">
                  {t("dashboardQuickDesk.productModal.noCategory")}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-[1.3rem] border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
            <span>
              {t("dashboardQuickDesk.productModal.defaultPrice", {
                value: defaults.product.price || t("dashboardQuickDesk.notSet"),
              })}
            </span>
            <span>
              {t("dashboardQuickDesk.productModal.defaultCategory", {
                value:
                  categories.find(
                    (category) =>
                      String(category.id) === defaults.product.categoryId,
                  )?.name ?? t("dashboardQuickDesk.notSet"),
              })}
            </span>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveAction(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createProduct.isPending}>
              {createProduct.isPending
                ? t("common.processing")
                : t("dashboardQuickDesk.productModal.save")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeAction === "add-customer"}
        onOpenChange={(open) => setActiveAction(open ? "add-customer" : null)}
        title={t("dashboardQuickDesk.customerModal.title")}
        description={t("dashboardQuickDesk.customerModal.description")}
        contentClassName={modalContentClassName}
      >
        <form
          className="grid gap-5 p-6"
          onSubmit={handleCustomerSubmit}
          noValidate
        >
          <div className="rounded-[1.4rem] border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
            {t("dashboardQuickDesk.customerModal.hint")}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quick-customer-name">
                {t("dashboardQuickDesk.customerModal.name")}
              </Label>
              <Input
                ref={customerNameRef}
                id="quick-customer-name"
                value={customerForm.name}
                onChange={(event) =>
                  setCustomerForm((currentForm) => ({
                    ...currentForm,
                    name: event.target.value,
                  }))
                }
                placeholder={t(
                  "dashboardQuickDesk.customerModal.namePlaceholder",
                )}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quick-customer-phone">
                {t("dashboardQuickDesk.customerModal.phone")}
              </Label>
              <Input
                id="quick-customer-phone"
                value={customerForm.phone}
                onChange={(event) =>
                  setCustomerForm((currentForm) => ({
                    ...currentForm,
                    phone: event.target.value.replace(/[^\d]/g, ""),
                  }))
                }
                placeholder={t(
                  "dashboardQuickDesk.customerModal.phonePlaceholder",
                )}
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-[1.3rem] border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
            <span>
              {t("dashboardQuickDesk.customerModal.defaultPhone", {
                value:
                  defaults.customer.phone || t("dashboardQuickDesk.notSet"),
              })}
            </span>
            <span>
              {t("dashboardQuickDesk.customerModal.recentQuickSaves", {
                count: formatNumber(
                  recentCustomers.length > 0 ? recentCustomers.length : 0,
                ),
              })}
            </span>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveAction(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createCustomer.isPending}>
              {createCustomer.isPending
                ? t("common.processing")
                : t("dashboardQuickDesk.customerModal.save")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default QuickActions;
