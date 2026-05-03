"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  QrCode,
  ShieldCheck,
  Upload,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Modal from "@/components/ui/modal";
import {
  createAccessRazorpayOrder,
  fetchAccessPaymentStatus,
  type AccessPaymentRecord,
  type AccessPaymentStatusResponse,
  uploadAccessPaymentProof,
  verifyAccessRazorpayPayment,
} from "@/lib/apiClient";
import { workspaceQueryKeys } from "@/hooks/useWorkspaceQueries";

type PaymentAccessClientProps = {
  userName: string;
  userEmail: string;
};

const RAZORPAY_CHECKOUT_SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";
const RAZORPAY_CHECKOUT_SCRIPT_SELECTOR =
  'script[data-razorpay-checkout="true"]';

type RazorpaySuccessPayload = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: RazorpaySuccessPayload) => void | Promise<void>;
};

type RazorpayInstance = {
  open: () => void;
  on?: (event: string, callback: (payload: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const statusMeta: Record<
  AccessPaymentRecord["status"] | "none",
  { label: string; variant: "default" | "paid" | "pending" | "overdue" }
> = {
  none: { label: "No verified payment yet", variant: "default" },
  pending: { label: "Pending admin review", variant: "pending" },
  approved: { label: "Approved", variant: "paid" },
  rejected: { label: "Rejected", variant: "overdue" },
  success: { label: "Paid and active", variant: "paid" },
};

const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PROOF_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);
const ACCEPTED_PROOF_EXTENSIONS = new Set(["jpg", "jpeg", "png", "pdf"]);

type ManualPaymentErrors = Partial<
  Record<"name" | "mobileNumber" | "utr" | "paymentProof", string>
>;

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string;
          error?: string;
          details?: { errors?: Record<string, string[]> };
        }
      | undefined;
    const fieldErrors = data?.details?.errors;
    const firstFieldError = fieldErrors
      ? Object.values(fieldErrors).flat().find(Boolean)
      : null;

    return firstFieldError ?? data?.message ?? data?.error ?? fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

const getFileExtension = (fileName: string) =>
  fileName.split(".").pop()?.trim().toLowerCase() ?? "";

const validateProofFile = (file: File | null) => {
  if (!file) {
    return "Upload a payment proof file.";
  }

  const extension = getFileExtension(file.name);
  if (
    !ACCEPTED_PROOF_MIME_TYPES.has(file.type) ||
    !ACCEPTED_PROOF_EXTENSIONS.has(extension)
  ) {
    return "Upload only JPG, JPEG, PNG, or PDF payment proof.";
  }

  if (file.size > MAX_PROOF_SIZE_BYTES) {
    return "File exceeds 5MB limit";
  }

  return null;
};

export default function PaymentAccessClient({
  userName,
  userEmail,
}: PaymentAccessClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedPlan = searchParams.get("plan");
  const [statusData, setStatusData] = useState<AccessPaymentStatusResponse | null>(
    null,
  );
  const [selectedPlanId, setSelectedPlanId] = useState<"pro" | "pro-plus">(
    requestedPlan === "pro-plus" ? "pro-plus" : "pro",
  );
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    searchParams.get("cycle") === "yearly" ? "yearly" : "monthly",
  );
  const [name, setName] = useState(userName);
  const [mobileNumber, setMobileNumber] = useState("");
  const [utr, setUtr] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [manualErrors, setManualErrors] = useState<ManualPaymentErrors>({});
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comparePlansOpen, setComparePlansOpen] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<
    "razorpay" | "upi"
  >("razorpay");
  const [isLoading, startLoadingTransition] = useTransition();
  const [isPaying, startPaymentTransition] = useTransition();
  const [isSubmittingUpi, startUpiTransition] = useTransition();

  const syncBillingQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.subscriptionStatus,
      }),
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.subscriptionPermissions,
      }),
      queryClient.invalidateQueries({ queryKey: ["workers"] }),
      queryClient.invalidateQueries({ queryKey: ["workers", "overview"] }),
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.businessProfile,
      }),
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.userProfile }),
    ]);
  };

  const loadStatus = () => {
    startLoadingTransition(() => {
      void (async () => {
        try {
          setError(null);
          const nextStatus = await fetchAccessPaymentStatus();
          setStatusData(nextStatus);
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load payment status.",
          );
        }
      })();
    });
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!screenshot || !screenshot.type.startsWith("image/")) {
      setProofPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
      return;
    }

    const nextUrl = URL.createObjectURL(screenshot);
    setProofPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextUrl;
    });

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [screenshot]);

  const selectedPlan = useMemo(
    () => statusData?.plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [selectedPlanId, statusData],
  );
  const monthlyAmount = selectedPlan?.amounts.monthly ?? 0;
  const yearlyAmount = selectedPlan?.amounts.yearly ?? 0;
  const selectedAmount = selectedPlan?.amounts[billingCycle] ?? 0;
  const yearlySavingsPercent =
    monthlyAmount > 0 && yearlyAmount > 0
      ? Math.max(0, Math.round((1 - yearlyAmount / (monthlyAmount * 12)) * 100))
      : 0;
  const gstAmount = 0;
  const finalPayableAmount = selectedAmount + gstAmount;
  const hasActiveSubscription = Boolean(statusData?.hasAccess);
  const canStartPayment = Boolean(
    selectedPlan &&
      statusData?.businessProfileCompleted !== false &&
      !hasActiveSubscription,
  );
  const selectedPlanPaymentHistory = useMemo(
    () =>
      statusData?.payments.filter(
        (payment) =>
          payment.method === "upi" &&
          payment.planId === selectedPlanId &&
          payment.billingCycle === billingCycle,
      ) ?? [],
    [billingCycle, selectedPlanId, statusData?.payments],
  );
  const selectedPendingManualPayment = selectedPlanPaymentHistory.find(
    (payment) => payment.status === "pending",
  );
  const selectedRejectedManualPayment = selectedPlanPaymentHistory.find(
    (payment) => payment.status === "rejected",
  );

  const currentStatus = statusData?.activePayment?.status ?? statusData?.payments[0]?.status ?? "none";
  const currentStatusMeta = statusMeta[currentStatus];
  const normalizedUtr = utr.trim().toUpperCase();
  const duplicateUtrPayment = useMemo(
    () =>
      normalizedUtr
        ? statusData?.payments.find(
            (payment) =>
              payment.method === "upi" &&
              payment.status !== "rejected" &&
              payment.utr?.toUpperCase() === normalizedUtr,
          )
        : undefined,
    [normalizedUtr, statusData?.payments],
  );
  const selectedUpiLink = selectedPlan?.upiLink[billingCycle] ?? "";
  const qrCodeUrl = selectedUpiLink
    ? `https://quickchart.io/qr?size=220&text=${encodeURIComponent(selectedUpiLink)}`
    : "";

  const copyToClipboard = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setBanner(message);
      toast.success(message);
    } catch {
      setError("Clipboard access failed. Copy it manually.");
      toast.error("Clipboard access failed. Copy it manually.");
    }
  };

  const validateManualPayment = () => {
    const nextErrors: ManualPaymentErrors = {};
    const trimmedName = name.trim();
    const normalizedMobile = mobileNumber.replace(/\D/g, "");
    const proofError = validateProofFile(screenshot);

    if (!trimmedName) {
      nextErrors.name = "Full name is required.";
    } else if (trimmedName.length < 3) {
      nextErrors.name = "Full name must be at least 3 characters.";
    }

    if (!/^\d{10}$/.test(normalizedMobile)) {
      nextErrors.mobileNumber = "Enter a valid Indian 10 digit mobile number.";
    }

    if (!normalizedUtr) {
      nextErrors.utr = "UTR number is required.";
    } else if (!/^[A-Z0-9]{8,30}$/.test(normalizedUtr)) {
      nextErrors.utr =
        "UTR must be 8 to 30 uppercase letters and numbers only.";
    } else if (duplicateUtrPayment) {
      nextErrors.utr = "This UTR number has already been submitted.";
    }

    if (proofError) {
      nextErrors.paymentProof = proofError;
    }

    setManualErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRazorpayPayment = () => {
    setSelectedPaymentMode("razorpay");

    if (!statusData?.razorpay.enabled || !statusData.razorpay.keyId) {
      setError("Razorpay is not configured yet.");
      toast.error("Razorpay is not configured yet.");
      return;
    }

    if (!selectedPlan) {
      setError("Select a plan before starting payment.");
      toast.error("Select a plan before starting payment.");
      return;
    }

    if (statusData?.businessProfileCompleted === false) {
      setError("Complete your business profile before starting payment.");
      toast.error("Complete your business profile before starting payment.");
      return;
    }

    if (hasActiveSubscription) {
      setError("You already have an active paid subscription.");
      toast.info("You already have an active paid subscription.");
      return;
    }

    if (!window.Razorpay) {
      setError("Razorpay checkout is still loading. Try again in a moment.");
      toast.error("Razorpay checkout is still loading. Try again in a moment.");
      return;
    }

    const RazorpayCheckout = window.Razorpay;
    const razorpayKey = statusData.razorpay.keyId;

    if (!razorpayKey) {
      setError("Razorpay is not configured yet.");
      toast.error("Razorpay is not configured yet.");
      return;
    }

    startPaymentTransition(() => {
      void (async () => {
        try {
          setError(null);
          setBanner(null);

          const order = await createAccessRazorpayOrder({
            plan_id: selectedPlan.id,
            billing_cycle: billingCycle,
          });

          const razorpay = new RazorpayCheckout({
            key: razorpayKey,
            amount: order.amount,
            currency: order.currency,
            name: "BillSutra",
            description: `${selectedPlan.name} (${billingCycle}) access`,
            order_id: order.orderId,
            prefill: {
              name: userName,
              email: userEmail,
            },
            theme: {
              color: "#1d4ed8",
            },
            handler: async (response) => {
              await verifyAccessRazorpayPayment(response);
              await syncBillingQueries();
              setBanner("Razorpay payment verified and access unlocked.");
              toast.success("Razorpay payment verified and access unlocked.");
              loadStatus();
              router.refresh();
            },
          });

          razorpay.on?.("payment.failed", () => {
            setError("Razorpay reported a failed payment. Please try again.");
            toast.error("Razorpay reported a failed payment. Please try again.");
          });

          razorpay.open();
        } catch (paymentError) {
          const message = getApiErrorMessage(
            paymentError,
            "Unable to start Razorpay checkout.",
          );
          setError(message);
          toast.error(message);
        }
      })();
    });
  };

  const handleUpiSubmit = () => {
    setSelectedPaymentMode("upi");

    if (!selectedPlan) {
      setError("Select a plan before submitting UPI proof.");
      toast.error("Select a plan before submitting UPI proof.");
      return;
    }

    if (statusData?.businessProfileCompleted === false) {
      setError("Complete your business profile before uploading proof.");
      toast.error("Complete your business profile before uploading proof.");
      return;
    }

    if (hasActiveSubscription) {
      setError("You already have an active paid subscription.");
      toast.info("You already have an active paid subscription.");
      return;
    }

    if (!validateManualPayment()) {
      setError("Fix the highlighted payment proof details before submitting.");
      toast.error("Fix the highlighted payment proof details before submitting.");
      return;
    }

    if (selectedPendingManualPayment) {
      setError("A payment proof for this plan is already pending review.");
      toast.error("A payment proof for this plan is already pending review.");
      return;
    }

    const proofFile = screenshot;
    if (!proofFile) {
      setError("Upload a payment proof file before submitting.");
      toast.error("Upload a payment proof file before submitting.");
      return;
    }

    startUpiTransition(() => {
      void (async () => {
        try {
          setError(null);
          setBanner(null);
          setUploadProgress(0);

          let uploaded: AccessPaymentRecord | null = null;
          let lastError: unknown = null;

          for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
              uploaded = await uploadAccessPaymentProof(
                {
                  planId: selectedPlan.id,
                  billingCycle,
                  name: name.trim(),
                  mobileNumber: mobileNumber.replace(/\D/g, ""),
                  utr: normalizedUtr,
                  paymentProof: proofFile,
                },
                {
                  onUploadProgress: (progressPercent) =>
                    setUploadProgress(progressPercent),
                },
              );
              break;
            } catch (submitError) {
              lastError = submitError;
              const retryable =
                isAxiosError(submitError) &&
                ((submitError.response?.status ?? 0) >= 500 ||
                  submitError.code === "ERR_NETWORK");

              if (!retryable || attempt === 2) {
                throw submitError;
              }
            }
          }

          if (!uploaded) {
            throw lastError instanceof Error
              ? lastError
              : new Error("Upload failed.");
          }

          setBanner("Proof uploaded. Awaiting approval.");
          toast.success("Proof uploaded. Awaiting approval.");
          setUtr("");
          setMobileNumber("");
          setScreenshot(null);
          setManualErrors({});
          setUploadProgress(100);
          loadStatus();
        } catch (submitError) {
          const message = getApiErrorMessage(
            submitError,
            "Unable to upload payment proof.",
          );
          setError(message);
          toast.error(message);
          setUploadProgress(0);
        }
      })();
    });
  };

  return (
    <>
      <Script id="razorpay-checkout-loader" strategy="afterInteractive">
        {`
          if (!window.Razorpay && !document.querySelector('${RAZORPAY_CHECKOUT_SCRIPT_SELECTOR}')) {
            const script = document.createElement('script');
            script.src = '${RAZORPAY_CHECKOUT_SCRIPT_URL}';
            script.async = true;
            script.dataset.razorpayCheckout = 'true';
            document.body.appendChild(script);
          }
        `}
      </Script>

      <div className="grid gap-6">
        <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_48%,#38bdf8_100%)] text-white shadow-[0_36px_90px_-54px_rgba(37,99,235,0.7)]">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-100/80">
                  Payment access
                </p>
                <CardTitle className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  Unlock your paid workspace with Razorpay or manual UPI
                </CardTitle>
                <CardDescription className="mt-3 max-w-3xl whitespace-normal text-blue-50/88">
                  Razorpay payments are verified automatically. Manual UPI
                  payments stay pending until an admin approves the UTR and proof.
                </CardDescription>
              </div>

              <Badge variant={currentStatusMeta.variant} className="border-white/15 bg-white/10 text-white">
                <ShieldCheck className="mr-1 size-3.5" />
                {currentStatusMeta.label}
              </Badge>
              <Button asChild variant="secondary" className="bg-white text-slate-950 hover:bg-blue-50">
                <Link href="/pricing">
                  Need help?
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-blue-100/76">Selected plan</p>
              <p className="mt-2 text-2xl font-semibold">
                {selectedPlan?.name ?? "Loading..."}
              </p>
              <p className="mt-2 text-sm text-blue-50/82">
                {billingCycle === "yearly" ? "Yearly" : "Monthly"} billing,{" "}
                {selectedPlan ? formatCurrency(finalPayableAmount) : "amount loading"}.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-blue-100/76">Current payment status</p>
              <p className="mt-2 text-lg font-semibold">
                {currentStatusMeta.label}
              </p>
              <p className="mt-2 text-sm text-blue-50/82">
                {statusData?.hasAccess ? "Workspace access is unlocked." : "Pending, approved, rejected, and paid states appear here."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-blue-100/76">Last updated</p>
              <p className="mt-2 text-lg font-semibold">
                {statusData?.payments[0]
                  ? formatDateTime(statusData.payments[0].updatedAt)
                  : "No payment yet"}
              </p>
              <p className="mt-2 text-sm text-blue-50/82">
                {statusData?.payments[0]?.method === "upi"
                  ? "Manual UPI entries stay pending until reviewed."
                  : "Razorpay records become active right after backend verification."}
              </p>
            </div>
          </CardContent>
        </Card>

        {banner ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {banner}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Card className="bg-white/95">
            <CardHeader>
              <CardTitle>Choose a paid plan</CardTitle>
              <CardDescription className="whitespace-normal">
                The backend calculates the amount from the selected plan and cycle,
                so the final charge is not trusted from the browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                {statusData?.plans.map((plan) => {
                  const selected = selectedPlanId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => {
                        if (!hasActiveSubscription) {
                          setSelectedPlanId(plan.id);
                        }
                      }}
                      disabled={hasActiveSubscription}
                      className={`rounded-3xl border p-5 text-left transition ${
                        selected
                          ? "border-blue-600 bg-blue-50 shadow-[0_18px_40px_-28px_rgba(37,99,235,0.55)]"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                      } ${hasActiveSubscription ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                            {plan.id === "pro-plus" ? "Growth" : "Popular"}
                          </p>
                          <h3 className="mt-2 text-xl font-semibold text-slate-950">
                            {plan.name}
                          </h3>
                        </div>
                        <Badge variant={selected ? "paid" : "default"}>
                          {hasActiveSubscription
                            ? "Subscribed"
                            : selected
                              ? "Selected"
                              : "Choose"}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {plan.description}
                      </p>
                      <div className="mt-4 rounded-2xl bg-white/80 p-4">
                        <p className="text-sm text-slate-500">Current price</p>
                        <p className="mt-2 text-3xl font-semibold text-slate-950">
                          {formatCurrency(plan.amounts[billingCycle])}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          billed {billingCycle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-3">
                {(["monthly", "yearly"] as const).map((cycle) => (
                  <Button
                    key={cycle}
                    type="button"
                    variant={billingCycle === cycle ? "default" : "outline"}
                    onClick={() => setBillingCycle(cycle)}
                    disabled={hasActiveSubscription}
                  >
                    {cycle === "monthly"
                      ? "Monthly billing"
                      : `Yearly billing${yearlySavingsPercent ? ` - save ${yearlySavingsPercent}%` : ""}`}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setComparePlansOpen(true)}
                >
                  Compare features
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)]">
            <CardHeader>
              <CardTitle>Payment summary</CardTitle>
              <CardDescription className="whitespace-normal">
                Use the fast Razorpay flow for instant activation, or pay through
                your UPI app and upload the UTR for admin review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">Selected plan</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {selectedPlan?.name ?? "Loading..."}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {billingCycle === "monthly" ? "Monthly" : "Yearly"} charge:{" "}
                  {selectedPlan ? formatCurrency(selectedAmount) : "N/A"}
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">GST</span>
                  <span className="font-medium text-slate-900">
                    {gstAmount > 0 ? formatCurrency(gstAmount) : "Included / not applied"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Billing cycle</span>
                  <span className="font-medium capitalize text-slate-900">
                    {billingCycle}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Payment mode</span>
                  <span className="font-medium text-slate-900">
                    {selectedPaymentMode === "razorpay" ? "Razorpay" : "Manual UPI"}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-950">Final payable</span>
                    <span className="text-xl font-semibold text-slate-950">
                      {formatCurrency(finalPayableAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {statusData?.businessProfileCompleted === false ? (
                <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Complete your business profile before starting a billing payment.
                </div>
              ) : null}

              {hasActiveSubscription ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Your paid subscription is already active. New payments are disabled.
                </div>
              ) : null}

              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={handleRazorpayPayment}
                disabled={isPaying || isLoading || !canStartPayment}
              >
                <CreditCard className="size-4" />
                {isPaying ? "Starting Razorpay..." : "Pay with Razorpay"}
              </Button>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Backend verification happens after checkout with the Razorpay
                signature, so browser callbacks alone never unlock access.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.95fr)]">
          <Card className="bg-white/95">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-950 p-3 text-white">
                  <Wallet className="size-5" />
                </div>
                <div>
                  <CardTitle>Manual UPI payment</CardTitle>
                  <CardDescription className="whitespace-normal">
                    Pay in any UPI app, then upload the payment proof for admin review.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedPendingManualPayment ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  A proof for this plan is already pending review. Wait for admin action before uploading another.
                </div>
              ) : null}

              {selectedRejectedManualPayment ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {selectedRejectedManualPayment.adminNote?.trim()
                    ? `Previous proof was rejected: ${selectedRejectedManualPayment.adminNote}`
                    : "Your previous proof was rejected. Upload a fresh proof to try again."}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">UPI ID</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {statusData?.upi.upiId ?? "Loading..."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        statusData?.upi.upiId
                          ? (setSelectedPaymentMode("upi"),
                            void copyToClipboard(
                              statusData.upi.upiId,
                              "UPI ID copied to clipboard.",
                            ))
                          : undefined
                      }
                    >
                      <Copy className="size-4" />
                      Copy UPI ID
                    </Button>
                    <Button asChild onClick={() => setSelectedPaymentMode("upi")}>
                      <a href={selectedUpiLink}>
                        <ExternalLink className="size-4" />
                        Open UPI app
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Payee</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {statusData?.upi.payeeName ?? "BillSutra"}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">
                    Match the amount exactly before you submit the UTR.
                  </p>
                  <p className="mt-4 text-2xl font-semibold text-slate-950">
                    {selectedPlan ? formatCurrency(selectedPlan.amounts[billingCycle]) : "N/A"}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-slate-700">
                    <QrCode className="size-6" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-800">
                    Scan to pay
                  </p>
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="UPI QR code"
                      className="mx-auto mt-4 rounded-2xl border border-slate-200 bg-white p-3"
                    />
                  ) : (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
                      QR code is loading...
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="manual-upi-name">
                      Name
                    </label>
                    <Input
                      id="manual-upi-name"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setManualErrors((current) => ({
                          ...current,
                          name: undefined,
                        }));
                      }}
                      className="mt-2"
                      placeholder="Enter the payer name"
                    />
                    {manualErrors.name ? (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {manualErrors.name}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="manual-upi-mobile">
                      Mobile number
                    </label>
                    <Input
                      id="manual-upi-mobile"
                      value={mobileNumber}
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(event) => {
                        setMobileNumber(
                          event.target.value.replace(/\D/g, "").slice(0, 10),
                        );
                        setManualErrors((current) => ({
                          ...current,
                          mobileNumber: undefined,
                        }));
                      }}
                      className="mt-2"
                      placeholder="10 digit mobile number"
                    />
                    {manualErrors.mobileNumber ? (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {manualErrors.mobileNumber}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="manual-upi-utr">
                      UTR number
                    </label>
                    <Input
                      id="manual-upi-utr"
                      value={utr}
                      onChange={(event) => {
                        setUtr(
                          event.target.value
                            .replace(/[^a-z0-9]/gi, "")
                            .toUpperCase()
                            .slice(0, 30),
                        );
                        setManualErrors((current) => ({
                          ...current,
                          utr: undefined,
                        }));
                      }}
                      className="mt-2"
                      placeholder="Example: 1234ABCD5678"
                    />
                    {manualErrors.utr ? (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {manualErrors.utr}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-slate-500">Selected plan</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {selectedPlan?.name ?? "Select a plan"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Amount</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {formatCurrency(finalPayableAmount)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="manual-upi-proof">
                      Payment proof
                    </label>
                    <Input
                      id="manual-upi-proof"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,application/pdf"
                      className="mt-2"
                      onChange={(event) => {
                        setUploadProgress(0);
                        const nextFile = event.target.files?.[0] ?? null;
                        const validationError = validateProofFile(nextFile);

                        if (validationError) {
                          setScreenshot(null);
                          setManualErrors((current) => ({
                            ...current,
                            paymentProof: validationError,
                          }));
                          if (nextFile) {
                            toast.error(validationError);
                          }
                          event.target.value = "";
                          return;
                        }

                        setManualErrors((current) => ({
                          ...current,
                          paymentProof: undefined,
                        }));
                        setScreenshot(nextFile);
                      }}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Required. Upload JPG, JPEG, PNG, or PDF up to 5 MB.
                    </p>
                    {manualErrors.paymentProof ? (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {manualErrors.paymentProof}
                      </p>
                    ) : null}
                  </div>

                  {screenshot ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-800">
                        Selected proof
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {screenshot.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {(screenshot.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      {proofPreviewUrl ? (
                        <img
                          src={proofPreviewUrl}
                          alt="Payment proof preview"
                          className="mt-3 max-h-52 rounded-2xl border border-slate-200 object-contain"
                        />
                      ) : screenshot.type === "application/pdf" ? (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                          <FileText className="size-4" />
                          PDF proof selected
                        </div>
                      ) : (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                          <FileText className="size-4" />
                          Preview unavailable for this file type
                        </div>
                      )}
                    </div>
                  ) : null}

                  {isSubmittingUpi && uploadProgress > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between text-sm text-slate-700">
                        <span>Uploading proof...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-[width] duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleUpiSubmit}
                    disabled={
                      isSubmittingUpi ||
                      !canStartPayment ||
                      !screenshot ||
                      Boolean(selectedPendingManualPayment)
                    }
                  >
                    <Upload className="size-4" />
                    {isSubmittingUpi ? "Uploading proof..." : "Upload payment proof"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95">
            <CardHeader>
              <CardTitle>Payment timeline</CardTitle>
              <CardDescription className="whitespace-normal">
                Track pending reviews, approvals, and verified online payments in one place.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusData?.payments.length ? (
                statusData.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {(payment.planId === "pro-plus" ? "Pro Plus" : "Pro")} •{" "}
                          {payment.billingCycle}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {payment.method === "upi"
                            ? `UTR ${payment.utr ?? "not provided"}`
                            : `Payment ID ${payment.paymentId ?? payment.orderId ?? "pending"}`}
                        </p>
                      </div>
                      <Badge variant={statusMeta[payment.status].variant}>
                        {statusMeta[payment.status].label}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <span>{formatCurrency(payment.amount)}</span>
                      <span>•</span>
                      <span>{formatDateTime(payment.createdAt)}</span>
                      {payment.proofUrl ? (
                        <>
                          <span>•</span>
                          <a
                            href={payment.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-slate-700 underline-offset-4 hover:underline"
                          >
                            View proof
                            <ExternalLink className="size-3.5" />
                          </a>
                        </>
                      ) : null}
                    </div>

                    {payment.reviewedAt ? (
                      <p className="mt-3 text-xs text-slate-500">
                        Reviewed {formatDateTime(payment.reviewedAt)}
                        {payment.reviewedByAdminEmail
                          ? ` by ${payment.reviewedByAdminEmail}`
                          : ""}
                      </p>
                    ) : null}
                    {payment.adminNote ? (
                      <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        Admin note: {payment.adminNote}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  No payments submitted yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
          <CardHeader>
            <CardTitle>Security checks included</CardTitle>
            <CardDescription className="whitespace-normal">
              These are enforced by the backend before access is granted.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Server-side signature verification",
                copy: "Razorpay callbacks only unlock access after HMAC verification with the secret key.",
                icon: CheckCircle2,
              },
              {
                title: "Manual UTR validation",
                copy: "Manual UPI submissions reject invalid or duplicate UTR numbers.",
                icon: Clock3,
              },
              {
                title: "Rate limiting",
                copy: "Order creation, verification, and manual proof uploads are all rate-limited.",
                icon: ShieldCheck,
              },
              {
                title: "Protected access gate",
                copy: "Only approved or successful payments satisfy the backend access guard.",
                icon: XCircle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-slate-200 bg-white p-5"
                >
                  <div className="inline-flex rounded-2xl bg-slate-950 p-3 text-white">
                    <Icon className="size-5" />
                  </div>
                  <p className="mt-4 font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={comparePlansOpen}
        onOpenChange={setComparePlansOpen}
        title="Compare paid plans"
        description="Review the main access differences before choosing a billing cycle."
        contentClassName="max-w-3xl"
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-slate-50 text-sm font-semibold text-slate-700">
            <div className="p-3">Feature</div>
            <div className="p-3">Pro</div>
            <div className="p-3">Pro Plus</div>
          </div>
          {[
            ["Invoices", "Unlimited", "Unlimited"],
            ["Worker management", "Included", "Included"],
            ["Analytics", "Standard", "Advanced"],
            ["Exports", "Basic", "Advanced"],
            ["Operational controls", "Core controls", "Premium controls"],
          ].map(([feature, pro, proPlus]) => (
            <div
              key={feature}
              className="grid grid-cols-[1.1fr_1fr_1fr] border-t border-slate-200 text-sm"
            >
              <div className="p-3 font-medium text-slate-900">{feature}</div>
              <div className="p-3 text-slate-600">{pro}</div>
              <div className="p-3 text-slate-600">{proPlus}</div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
