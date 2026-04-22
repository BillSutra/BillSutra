"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  type BusinessProfileRecord,
  type Customer,
  deleteUserAccount,
  deleteUserData,
  type Invoice,
  type SecurityActivityEvent,
  type SubscriptionSnapshot,
  type UserPermissions,
  fetchBusinessProfile,
  fetchCustomers,
  fetchInvoices,
  fetchProducts,
  fetchSecurityActivity,
  fetchSubscriptionStatus,
  fetchUserPermissions,
  fetchUserProfile,
  updateUserPassword,
  updateUserProfile,
  type UserProfile,
} from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Modal from "@/components/ui/modal";
import Link from "next/link";
import PasskeySettingsCard from "@/components/profile/PasskeySettingsCard";
import FaceRegistrationModal from "@/components/auth/FaceRegistrationModal";
import PlanManagementCard from "@/components/pricing/PlanManagementCard";
import ProfileOverviewStat from "@/components/profile/ProfileOverviewStat";
import { useI18n } from "@/providers/LanguageProvider";
import {
  Building2,
  CalendarClock,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";

type ProfileClientProps = {
  initialProfile: UserProfile;
  previewData?: {
    businessProfile?: BusinessProfileRecord | null;
    subscription?: SubscriptionSnapshot;
    permissions?: UserPermissions;
    invoices?: Invoice[];
    customers?: Customer[];
    productCount?: number;
    securityActivity?: SecurityActivityEvent[];
  };
};

const ProfileClient = ({ initialProfile, previewData }: ProfileClientProps) => {
  const router = useRouter();
  const { t, language } = useI18n();
  const queryStaleTime = 60_000;

  const { data } = useQuery({
    queryKey: ["users", "me"],
    queryFn: fetchUserProfile,
    initialData: initialProfile,
    enabled: !previewData,
    staleTime: queryStaleTime,
  });

  const { data: businessProfileQuery, isLoading: isBusinessLoading } = useQuery(
    {
      queryKey: ["profile", "business"],
      queryFn: fetchBusinessProfile,
      initialData: previewData?.businessProfile,
      enabled: !previewData,
      staleTime: queryStaleTime,
    },
  );

  const { data: subscriptionQuery, isLoading: isSubscriptionLoading } =
    useQuery({
      queryKey: ["profile", "subscription"],
      queryFn: fetchSubscriptionStatus,
      initialData: previewData?.subscription,
      enabled: !previewData,
      staleTime: queryStaleTime,
    });

  const { data: permissionsQuery, isLoading: isPermissionsLoading } = useQuery({
    queryKey: ["profile", "permissions"],
    queryFn: fetchUserPermissions,
    initialData: previewData?.permissions,
    enabled: !previewData,
    staleTime: queryStaleTime,
  });

  const { data: invoicesQuery, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ["profile", "invoices"],
    queryFn: fetchInvoices,
    initialData: previewData?.invoices,
    enabled: !previewData,
    staleTime: queryStaleTime,
  });

  const { data: customersQuery, isLoading: isCustomersLoading } = useQuery({
    queryKey: ["profile", "customers"],
    queryFn: () => fetchCustomers(),
    initialData: previewData?.customers,
    enabled: !previewData,
    staleTime: queryStaleTime,
  });

  const { data: productsPageQuery, isLoading: isProductsLoading } = useQuery({
    queryKey: ["profile", "product-count"],
    queryFn: () => fetchProducts({ page: 1, limit: 1 }),
    initialData: previewData
      ? {
          products: [],
          total: previewData.productCount ?? 0,
          page: 1,
          limit: 1,
          totalPages: 1,
        }
      : undefined,
    enabled: !previewData,
    staleTime: queryStaleTime,
  });

  const { data: securityActivityQuery, isLoading: isSecurityLoading } =
    useQuery({
      queryKey: ["profile", "security-activity"],
      queryFn: fetchSecurityActivity,
      initialData: previewData?.securityActivity,
      enabled: !previewData,
      staleTime: queryStaleTime,
    });

  const profile = data ?? initialProfile;
  const businessProfile = previewData?.businessProfile ?? businessProfileQuery;
  const subscription = previewData?.subscription ?? subscriptionQuery;
  const permissions = previewData?.permissions ?? permissionsQuery;
  const invoices = useMemo(
    () => previewData?.invoices ?? invoicesQuery ?? [],
    [previewData?.invoices, invoicesQuery],
  );
  const customers = useMemo(
    () => previewData?.customers ?? customersQuery ?? [],
    [previewData?.customers, customersQuery],
  );
  const productsPage = productsPageQuery;
  const securityActivity = useMemo(
    () => previewData?.securityActivity ?? securityActivityQuery ?? [],
    [previewData?.securityActivity, securityActivityQuery],
  );
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [isFaceRegistrationOpen, setIsFaceRegistrationOpen] = useState(false);
  const [deleteDataOpen, setDeleteDataOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteDataConfirmation, setDeleteDataConfirmation] = useState("");
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] =
    useState("");
  const [deleteDataError, setDeleteDataError] = useState<string | null>(null);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(
    null,
  );
  const [deleteDataLoading, setDeleteDataLoading] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

  const canChangePassword = profile.provider !== "google";
  const locale = language === "hi" ? "hi-IN" : "en-IN";

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const formatCurrency = (value: number) =>
    currencyFormatter.format(value || 0);

  const formatDate = (value?: string | null) => {
    if (!value) return t("profilePage.hub.notAvailable");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
      return t("profilePage.hub.notAvailable");
    return parsed.toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return t("profilePage.hub.notAvailable");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
      return t("profilePage.hub.notAvailable");
    return parsed.toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
  }, [profile.name, profile.email]);

  const hasProfileChanges = useMemo(
    () => name.trim() !== profile.name || email.trim() !== profile.email,
    [name, email, profile.name, profile.email],
  );

  const productCount = previewData?.productCount ?? productsPage?.total ?? 0;

  const isSummaryLoading =
    !previewData &&
    ((isBusinessLoading && !businessProfile) ||
      (isSubscriptionLoading && !subscription) ||
      (isPermissionsLoading && !permissions) ||
      (isInvoicesLoading && !invoicesQuery) ||
      (isCustomersLoading && !customersQuery) ||
      (isProductsLoading && !productsPageQuery) ||
      (isSecurityLoading && !securityActivityQuery));

  const invoiceSummary = useMemo(() => {
    return invoices.reduce(
      (summary, invoice) => {
        const invoiceTotal = Number(invoice.total) || 0;
        const paidAmount = invoice.payments.reduce(
          (sum, payment) => sum + (Number(payment.amount) || 0),
          0,
        );
        const pendingAmount = Math.max(invoiceTotal - paidAmount, 0);
        const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
        const isOverdueByDate =
          dueDate instanceof Date &&
          !Number.isNaN(dueDate.getTime()) &&
          dueDate.getTime() < Date.now() &&
          pendingAmount > 0;

        summary.total += invoiceTotal;
        summary.pendingAmount += pendingAmount;

        if (
          invoice.status.toUpperCase().includes("OVERDUE") ||
          isOverdueByDate
        ) {
          summary.overdueCount += 1;
        }

        return summary;
      },
      { total: 0, pendingAmount: 0, overdueCount: 0 },
    );
  }, [invoices]);

  const businessCompletion = useMemo(() => {
    const checkpoints = [
      businessProfile?.business_name,
      businessProfile?.phone,
      businessProfile?.email,
      businessProfile?.businessAddress?.addressLine1 ??
        businessProfile?.address_line1 ??
        businessProfile?.address,
    ];

    const completed = checkpoints.filter(
      (value) => typeof value === "string" && value.trim().length > 0,
    ).length;

    const total = checkpoints.length;
    const percent = Math.round((completed / total) * 100);
    return { completed, total, percent };
  }, [businessProfile]);

  const businessAddress = useMemo(() => {
    if (!businessProfile) return t("profilePage.hub.notAvailable");

    const structuredAddress = [
      businessProfile.businessAddress?.addressLine1 ??
        businessProfile.address_line1 ??
        "",
      businessProfile.businessAddress?.city ?? businessProfile.city ?? "",
      businessProfile.businessAddress?.state ?? businessProfile.state ?? "",
      businessProfile.businessAddress?.pincode ?? businessProfile.pincode ?? "",
    ]
      .map((item) => item.trim())
      .filter(Boolean)
      .join(", ");

    if (structuredAddress) return structuredAddress;
    return businessProfile.address?.trim() || t("profilePage.hub.notAvailable");
  }, [businessProfile, t]);

  const latestSecurityEvent = securityActivity[0] ?? null;
  const recentSecurityEvents = securityActivity.slice(0, 4);

  const invoiceLimit = permissions?.features.maxInvoices;
  const invoiceLimitLabel =
    typeof invoiceLimit === "number"
      ? String(invoiceLimit)
      : t("profilePage.hub.unlimited");
  const invoicesUsed = permissions?.usage.invoicesUsed ?? 0;

  const invoiceUsagePercent =
    typeof invoiceLimit === "number" && invoiceLimit > 0
      ? Math.min(100, Math.round((invoicesUsed / invoiceLimit) * 100))
      : null;

  const subscriptionStatus =
    subscription?.status?.toLowerCase() ??
    (permissions?.isSubscribed ? "active" : "free");

  const subscriptionStatusLabel =
    subscriptionStatus === "trial"
      ? t("profilePage.hub.subscriptionStatus.trial")
      : subscriptionStatus === "active"
        ? t("profilePage.hub.subscriptionStatus.active")
        : subscriptionStatus === "expired"
          ? t("profilePage.hub.subscriptionStatus.expired")
          : subscriptionStatus === "cancelled"
            ? t("profilePage.hub.subscriptionStatus.cancelled")
            : t("profilePage.hub.subscriptionStatus.free");

  const planName =
    subscription?.planName ??
    (permissions?.plan
      ? permissions.plan
          .replace("_", " ")
          .replace(/\b\w/g, (character) => character.toUpperCase())
      : t("profilePage.hub.notAvailable"));

  const billingCycleLabel =
    subscription?.billingCycle === "monthly"
      ? t("profilePage.hub.billingCycle.monthly")
      : subscription?.billingCycle === "yearly"
        ? t("profilePage.hub.billingCycle.yearly")
        : t("profilePage.hub.billingCycle.trial");

  const cycleDateLabel = subscription?.currentPeriodEnd
    ? t("profilePage.hub.nextRenewal")
    : subscription?.trialEndsAt
      ? t("profilePage.hub.trialEnds")
      : t("profilePage.hub.lastEventAt");
  const cycleDateValue = formatDate(
    subscription?.currentPeriodEnd ??
      subscription?.trialEndsAt ??
      latestSecurityEvent?.createdAt,
  );

  const overviewCards = [
    {
      label: t("profilePage.hub.planOverview"),
      value: planName,
      hint: subscriptionStatusLabel,
      tone: permissions?.isSubscribed ? "success" : "info",
      icon: <Sparkles size={16} />,
    },
    {
      label: t("profilePage.hub.invoiceUsage"),
      value: `${invoicesUsed}/${invoiceLimitLabel}`,
      hint: t("profilePage.hub.invoiceUsageLabel"),
      tone: permissions?.limitsReached.invoicesLimitReached
        ? "warning"
        : "neutral",
      icon: <Wallet size={16} />,
    },
    {
      label: t("profilePage.hub.pendingCollections"),
      value: formatCurrency(invoiceSummary.pendingAmount),
      hint: t("profilePage.hub.overdueCount", {
        count: invoiceSummary.overdueCount,
      }),
      tone: invoiceSummary.overdueCount > 0 ? "warning" : "success",
      icon: <CalendarClock size={16} />,
    },
    {
      label: t("profilePage.hub.lastLogin"),
      value: formatDateTime(latestSecurityEvent?.createdAt),
      hint: latestSecurityEvent
        ? latestSecurityEvent.success
          ? t("profilePage.hub.securitySuccess")
          : t("profilePage.hub.securityFailed")
        : t("profilePage.hub.noSecurityActivity"),
      tone: latestSecurityEvent?.success ? "success" : "neutral",
      icon: <ShieldCheck size={16} />,
    },
  ] as const;

  const featureAccess = [
    {
      label: t("profilePage.hub.analyticsFeature"),
      enabled: Boolean(permissions?.features.analytics),
    },
    {
      label: t("profilePage.hub.exportFeature"),
      enabled: Boolean(permissions?.features.export),
    },
    {
      label: t("profilePage.hub.teamFeature"),
      enabled: Boolean(permissions?.features.teamAccess),
    },
  ];

  const deleteKeyword = t("profilePage.deleteKeyword");
  const canConfirmDeleteData =
    deleteDataConfirmation.trim() === "DELETE" ||
    deleteDataConfirmation.trim() === deleteKeyword;
  const deleteAccountVerification = deleteAccountConfirmation.trim();
  const canConfirmDeleteAccount =
    deleteAccountVerification === "DELETE" ||
    deleteAccountVerification === deleteKeyword ||
    deleteAccountVerification.toLowerCase() === profile.email.toLowerCase();

  const parseApiError = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      const message = (error.response?.data as { message?: string } | undefined)
        ?.message;
      if (message) return message;
    }

    return fallback;
  };

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    if (!hasProfileChanges) {
      setProfileError(t("profilePage.noChanges"));
      return;
    }

    setProfileSaving(true);
    try {
      const updated = await updateUserProfile({
        name: name.trim(),
        email: email.trim(),
      });
      setName(updated.name);
      setEmail(updated.email);
      setProfileMessage(t("profilePage.profileUpdated"));
    } catch {
      setProfileError(t("profilePage.profileUpdateError"));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t("profilePage.fillPasswordFields"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("profilePage.passwordMismatch"));
      return;
    }

    setPasswordSaving(true);
    try {
      await updateUserPassword({
        current_password: currentPassword,
        password: newPassword,
        confirm_password: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(t("profilePage.passwordUpdated"));
    } catch {
      setPasswordError(t("profilePage.passwordUpdateError"));
    } finally {
      setPasswordSaving(false);
    }
  };

  const closeDeleteDataModal = () => {
    setDeleteDataOpen(false);
    setDeleteDataConfirmation("");
    setDeleteDataError(null);
  };

  const closeDeleteAccountModal = () => {
    setDeleteAccountOpen(false);
    setDeleteAccountConfirmation("");
    setDeleteAccountError(null);
  };

  const handleDeleteData = async () => {
    if (!canConfirmDeleteData) return;

    setDeleteDataLoading(true);
    setDeleteDataError(null);
    try {
      await deleteUserData();
      toast.success(t("profilePage.deleteDataToast"));
      closeDeleteDataModal();
    } catch (error) {
      setDeleteDataError(
        parseApiError(error, t("profilePage.deleteDataError")),
      );
      toast.error(t("profilePage.deleteDataErrorToast"));
    } finally {
      setDeleteDataLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!canConfirmDeleteAccount) return;

    setDeleteAccountLoading(true);
    setDeleteAccountError(null);
    try {
      await deleteUserAccount();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("token");
        window.sessionStorage.setItem(
          "account_deleted_message",
          t("profilePage.deleteAccountDeletedMessage"),
        );
      }
      await signOut({ redirect: false });
      router.push("/");
      router.refresh();
    } catch (error) {
      setDeleteAccountError(
        parseApiError(error, t("profilePage.deleteAccountError")),
      );
      toast.error(t("profilePage.deleteAccountErrorToast"));
      setDeleteAccountLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top,#fffdf8,#f7f3ee_42%,#f2e9dc_100%)] text-[#1f1b16]"
      data-testid="profile-hub-layout"
    >
      <FaceRegistrationModal 
        isOpen={isFaceRegistrationOpen} 
        onClose={() => setIsFaceRegistrationOpen(false)}
        onSuccess={() => toast.success("Face registered successfully")}
      />
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6">
        <header className="rounded-3xl border border-[#eadccf] bg-white/90 p-6 shadow-[0_30px_80px_-60px_rgba(31,27,22,0.35)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8a6d56]">
                {t("profilePage.kicker")}
              </p>
              <h1
                className="mt-2 truncate text-3xl font-semibold tracking-tight"
                title={profile.name}
              >
                {profile.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c4b3b]">
                {t("profilePage.hub.subtitle")}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button asChild variant="outline" className="sm:w-auto">
                <Link href="/dashboard">
                  {t("profilePage.backToDashboard")}
                </Link>
              </Button>
              <Button asChild className="sm:w-auto">
                <Link href="/pricing">
                  {t("profilePage.hub.upgradePlan")}
                  <ExternalLink size={16} />
                </Link>
              </Button>
            </div>
          </div>

          <div
            className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            data-testid="profile-summary-cards"
          >
            {isSummaryLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`profile-summary-skeleton-${index}`}
                    className="app-loading-skeleton h-[118px] rounded-2xl"
                  />
                ))
              : overviewCards.map((card) => (
                  <ProfileOverviewStat
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    hint={card.hint}
                    tone={card.tone}
                    icon={card.icon}
                  />
                ))}
          </div>
        </header>

        <section className="mt-6 grid gap-4 xl:grid-cols-12">
          <div className="grid gap-4 xl:col-span-8">
            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("profilePage.accountDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={handleProfileSubmit}>
                  <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="profile-name">
                        {t("profilePage.fullName")}
                      </Label>
                      <Input
                        id="profile-name"
                        className="truncate text-sm sm:text-base"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={t("profilePage.enterName")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="profile-email">
                        {t("profilePage.emailAddress")}
                      </Label>
                      <Input
                        id="profile-email"
                        type="email"
                        className="truncate text-sm sm:text-base"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={t("profilePage.enterEmail")}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={profileSaving}>
                      {profileSaving
                        ? t("profilePage.saving")
                        : t("profilePage.saveChanges")}
                    </Button>
                    {profileMessage && (
                      <span className="text-sm text-[#0f766e]">
                        {profileMessage}
                      </span>
                    )}
                    {profileError && (
                      <span className="text-sm text-[#b45309]">
                        {profileError}
                      </span>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-[#ecdccf] bg-white/90">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {t("profilePage.hub.businessProfile")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm text-[#5c4b3b]">
                  <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                      {t("profilePage.hub.businessCompletion")}
                    </p>
                    <p className="mt-2 text-base font-semibold text-[#1f1b16]">
                      {t("profilePage.hub.businessCompletionValue", {
                        completed: businessCompletion.completed,
                        total: businessCompletion.total,
                      })}
                    </p>
                    <div className="mt-3 h-2 w-full rounded-full bg-[#f4e7dc]">
                      <div
                        className="h-full rounded-full bg-[#d9863a] transition-all"
                        style={{ width: `${businessCompletion.percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                      {t("profilePage.hub.businessProfile")}
                    </p>
                    <p className="text-sm font-semibold text-[#1f1b16]">
                      {businessProfile?.business_name?.trim() ||
                        t("profilePage.hub.notConfigured")}
                    </p>
                    <p className="text-sm text-[#5c4b3b]">{businessAddress}</p>
                    <p className="text-xs text-[#7f6652]">
                      {t("profilePage.hub.businessCurrency")}:{" "}
                      {businessProfile?.currency || "INR"}
                    </p>
                    <p className="text-xs text-[#7f6652]">
                      {t("profilePage.hub.businessUpdated", {
                        date: formatDate(businessProfile?.updated_at),
                      })}
                    </p>
                  </div>

                  <Button asChild variant="outline" className="justify-between">
                    <Link href="/business-profile">
                      {t("profilePage.hub.openBusinessProfile")}
                      <Building2 size={16} />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-[#ecdccf] bg-white/90">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {t("profilePage.hub.activitySnapshot")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                        {t("profilePage.hub.totalInvoices")}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                        {invoices.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                        {t("profilePage.hub.totalCustomers")}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                        {customers.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                        {t("profilePage.hub.totalProducts")}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                        {productCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                        {t("profilePage.hub.overdueInvoices")}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                        {invoiceSummary.overdueCount}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                      {t("profilePage.hub.recentSecurityActivity")}
                    </p>
                    <div className="mt-2 grid gap-2">
                      {recentSecurityEvents.length === 0 ? (
                        <p className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3 text-sm text-[#5c4b3b]">
                          {t("profilePage.hub.noSecurityActivity")}
                        </p>
                      ) : (
                        recentSecurityEvents.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold text-[#1f1b16]">
                                {event.method.replaceAll("_", " ")}
                              </p>
                              <span className="text-xs text-[#8a6d56]">
                                {formatDateTime(event.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#6b5442]">
                              {event.success
                                ? t("profilePage.hub.securitySuccess")
                                : t("profilePage.hub.securityFailed")}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-lg">
                  {t("profilePage.changePassword")}
                </CardTitle>
                <div className="rounded-full border border-[#ead8c8] bg-[#fff6ee] px-3 py-1 text-xs font-semibold text-[#8a6d56]">
                  <KeyRound size={14} className="mr-1 inline" />
                  {t("profilePage.hub.accountHealth")}
                </div>
              </CardHeader>
              <CardContent>
                {canChangePassword ? (
                  <form className="grid gap-4" onSubmit={handlePasswordSubmit}>
                    <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="current-password">
                          {t("profilePage.currentPassword")}
                        </Label>
                        <Input
                          id="current-password"
                          type="password"
                          value={currentPassword}
                          onChange={(event) =>
                            setCurrentPassword(event.target.value)
                          }
                          placeholder={t("profilePage.enterCurrentPassword")}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="new-password">
                          {t("profilePage.newPassword")}
                        </Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          placeholder={t("profilePage.enterNewPassword")}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="confirm-password">
                          {t("profilePage.confirmNewPassword")}
                        </Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          placeholder={t(
                            "profilePage.confirmNewPasswordPlaceholder",
                          )}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={passwordSaving}>
                        {passwordSaving
                          ? t("profilePage.updatingPassword")
                          : t("profilePage.updatePassword")}
                      </Button>
                      {passwordMessage && (
                        <span className="text-sm text-[#0f766e]">
                          {passwordMessage}
                        </span>
                      )}
                      {passwordError && (
                        <span className="text-sm text-[#b45309]">
                          {passwordError}
                        </span>
                      )}
                    </div>
                  </form>
                ) : (
                  <p className="text-sm text-[#5c4b3b]">
                    {t("profilePage.googlePasswordNotice")}
                  </p>
                )}
              </CardContent>
            </Card>

            <PasskeySettingsCard />

            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">
                  Facial Recognition
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4 text-sm text-[#5c4b3b]">
                  <p className="font-semibold text-[#1f1b16]">Face Login</p>
                  <p className="mt-1 mb-4">Register your face to enable secure and fast login without a password.</p>
                  <Button onClick={() => setIsFaceRegistrationOpen(true)}>
                    Register Face
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>

          <aside className="grid gap-4 xl:col-span-4">
            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("profilePage.hub.subscriptionInsights")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-[#5c4b3b]">
                <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {t("profilePage.hub.currentPlan")}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                    {planName}
                  </p>
                  <p className="mt-1 text-xs text-[#6b5442]">
                    {subscriptionStatusLabel}
                  </p>
                </div>

                <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {t("profilePage.hub.billingCycleLabel")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#1f1b16]">
                    {billingCycleLabel}
                  </p>
                  <p className="mt-1 text-xs text-[#6b5442]">
                    {cycleDateLabel}: {cycleDateValue}
                  </p>
                </div>

                <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {t("profilePage.hub.invoiceUsageLabel")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#1f1b16]">
                    {t("profilePage.hub.invoiceUsageValue", {
                      used: invoicesUsed,
                      limit: invoiceLimitLabel,
                    })}
                  </p>
                  {typeof invoiceUsagePercent === "number" ? (
                    <>
                      <div className="mt-3 h-2 w-full rounded-full bg-[#f4e7dc]">
                        <div
                          className="h-full rounded-full bg-[#d9863a] transition-all"
                          style={{ width: `${invoiceUsagePercent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-[#6b5442]">
                        {invoiceUsagePercent}%
                      </p>
                    </>
                  ) : null}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {t("profilePage.hub.featureAccess")}
                  </p>
                  <div className="mt-2 grid gap-2">
                    {featureAccess.map((feature) => (
                      <div
                        key={feature.label}
                        className="flex items-center justify-between rounded-lg border border-[#f2e6dc] bg-[#fff9f2] px-3 py-2"
                      >
                        <span className="text-sm text-[#4f4033]">
                          {feature.label}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            feature.enabled
                              ? "text-emerald-700"
                              : "text-[#9b7b62]"
                          }`}
                        >
                          {feature.enabled
                            ? t("profilePage.hub.enabled")
                            : t("profilePage.hub.disabled")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <PlanManagementCard
              title={t("profilePage.planTitle")}
              description={t("profilePage.planDescription")}
              compact
            />

            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("profilePage.hub.quickLinks")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button asChild variant="outline" className="justify-between">
                  <Link href="/business-profile">
                    {t("profilePage.hub.openBusinessProfile")}
                    <Building2 size={16} />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <Link href="/settings">
                    {t("profilePage.hub.openSettings")}
                    <ExternalLink size={16} />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <Link href="/invoices">
                    {t("profilePage.hub.openInvoices")}
                    <CalendarClock size={16} />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-[#ecdccf] bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("profilePage.hub.accountHealth")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-[#5c4b3b]">
                <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {t("profilePage.hub.profileProvider")}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-[#1f1b16]">
                    <UserRound size={15} />
                    <span className="truncate" title={profile.provider}>
                      {profile.provider}
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {t("profilePage.hub.emailVerification")}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-[#1f1b16]">
                    <ShieldCheck size={15} />
                    {profile.is_email_verified
                      ? t("profilePage.verified")
                      : t("profilePage.pending")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg text-red-700">
                  {t("profilePage.dangerZone")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {t("profilePage.deleteDataTitle")}
                  </p>
                  <p className="mt-1 text-sm text-red-700/90">
                    {t("profilePage.deleteDataDescription")}
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-4 w-full sm:w-auto"
                    onClick={() => setDeleteDataOpen(true)}
                  >
                    {t("profilePage.deleteMyData")}
                  </Button>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {t("profilePage.deleteAccountTitle")}
                  </p>
                  <p className="mt-1 text-sm text-red-700/90">
                    {t("profilePage.deleteAccountDescription")}
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-4 w-full sm:w-auto"
                    onClick={() => setDeleteAccountOpen(true)}
                  >
                    {t("profilePage.deleteMyAccount")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>

      <Modal
        open={deleteDataOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteDataModal();
            return;
          }
          setDeleteDataOpen(true);
        }}
        title={t("profilePage.deleteDataModalTitle")}
        description={t("profilePage.deleteDataModalDescription")}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="delete-data-confirmation">
              {t("profilePage.deleteDataConfirmLabel")}
            </Label>
            <Input
              id="delete-data-confirmation"
              value={deleteDataConfirmation}
              onChange={(event) => {
                setDeleteDataConfirmation(event.target.value);
                setDeleteDataError(null);
              }}
              placeholder={deleteKeyword}
              autoComplete="off"
            />
          </div>
          {deleteDataError && (
            <p className="text-sm text-[#b45309]">{deleteDataError}</p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteDataModal}
              disabled={deleteDataLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteData}
              disabled={!canConfirmDeleteData || deleteDataLoading}
            >
              {deleteDataLoading
                ? t("profilePage.deleting")
                : t("profilePage.deleteDataButton")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteAccountOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteAccountModal();
            return;
          }
          setDeleteAccountOpen(true);
        }}
        title={t("profilePage.deleteAccountModalTitle")}
        description={t("profilePage.deleteAccountModalDescription")}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="delete-account-confirmation">
              {t("profilePage.deleteAccountConfirmLabel")}
            </Label>
            <Input
              id="delete-account-confirmation"
              value={deleteAccountConfirmation}
              onChange={(event) => {
                setDeleteAccountConfirmation(event.target.value);
                setDeleteAccountError(null);
              }}
              placeholder={profile.email || deleteKeyword}
              autoComplete="off"
            />
          </div>
          {deleteAccountError && (
            <p className="text-sm text-[#b45309]">{deleteAccountError}</p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteAccountModal}
              disabled={deleteAccountLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteAccount}
              disabled={!canConfirmDeleteAccount || deleteAccountLoading}
            >
              {deleteAccountLoading
                ? t("profilePage.deleting")
                : t("profilePage.deleteAccountButton")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProfileClient;
