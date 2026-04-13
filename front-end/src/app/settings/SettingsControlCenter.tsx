"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  Database,
  Download,
  Image as ImageIcon,
  Languages,
  Palette,
  Save,
  Shield,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PasskeySettingsCard from "@/components/profile/PasskeySettingsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  cancelSubscription,
  createWorker,
  deleteUserAccount,
  deleteWorker,
  fetchBusinessProfile,
  fetchLogoUrl,
  fetchSecurityActivity,
  fetchUserPermissions,
  fetchUserSettingsPreferences,
  fetchSubscriptionStatus,
  fetchTemplates,
  fetchUserProfile,
  fetchWorkers,
  logoutAllDevices,
  removeLogo,
  replaceLogo,
  runDataExport,
  saveBusinessProfile,
  saveUserSettingsPreferences,
  switchToFreePlan,
  updateUserPassword,
  updateUserProfile,
  updateWorker,
  uploadLogo,
  type Worker,
} from "@/lib/apiClient";
import { useI18n } from "@/providers/LanguageProvider";

type SettingsControlCenterProps = {
  name: string;
  image?: string;
};

type SectionKey =
  | "business-profile"
  | "billing-subscription"
  | "team-permissions"
  | "security"
  | "data-backup"
  | "invoice-branding"
  | "app-preferences"
  | "notifications";

type AppPrefs = {
  currency: "INR" | "USD";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
};

type NotificationPrefs = {
  paymentReminders: boolean;
  lowStockAlerts: boolean;
  dueInvoiceAlerts: boolean;
};

type BrandingPrefs = {
  templateId: string;
  themeColor: string;
  terms: string;
  signature: string;
};

type BackupPrefs = {
  autoBackupEnabled: boolean;
};

const DEFAULT_APP_PREFS: AppPrefs = {
  currency: "INR",
  dateFormat: "DD/MM/YYYY",
};

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  paymentReminders: true,
  lowStockAlerts: true,
  dueInvoiceAlerts: true,
};

const DEFAULT_BRANDING_PREFS: BrandingPrefs = {
  templateId: "",
  themeColor: "#1f4b7f",
  terms: "Payment due within 7 days. Goods once sold will not be taken back.",
  signature: "Authorized Signatory",
};

const DEFAULT_BACKUP_PREFS: BackupPrefs = {
  autoBackupEnabled: false,
};

const SectionCard = ({
  id,
  title,
  icon,
  description,
  open,
  onToggle,
  children,
}: {
  id: SectionKey;
  title: string;
  icon: ReactNode;
  description: string;
  open: boolean;
  onToggle: (id: SectionKey) => void;
  children: ReactNode;
}) => {
  return (
    <Card className="overflow-hidden border-border/70">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => onToggle(id)}
        aria-expanded={open}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-border/70 bg-muted/40 p-2">
                {icon}
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
            />
          </div>
        </CardHeader>
      </button>
      {open ? <CardContent className="pt-0">{children}</CardContent> : null}
    </Card>
  );
};

const ToggleRow = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) => {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-background/60 p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4"
      />
    </label>
  );
};

const defaultSectionState: Record<SectionKey, boolean> = {
  "business-profile": true,
  "billing-subscription": true,
  "team-permissions": false,
  security: false,
  "data-backup": false,
  "invoice-branding": false,
  "app-preferences": false,
  notifications: false,
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const SettingsControlCenter = ({ name, image }: SettingsControlCenterProps) => {
  const queryClient = useQueryClient();
  const { language, setLanguage } = useI18n();

  const [sections, setSections] =
    useState<Record<SectionKey, boolean>>(defaultSectionState);

  const [appPrefs, setAppPrefs] = useState<AppPrefs>(DEFAULT_APP_PREFS);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS,
  );
  const [brandingPrefs, setBrandingPrefs] = useState<BrandingPrefs>(
    DEFAULT_BRANDING_PREFS,
  );
  const [backupPrefs, setBackupPrefs] =
    useState<BackupPrefs>(DEFAULT_BACKUP_PREFS);

  const [ownerName, setOwnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);

  const [workerName, setWorkerName] = useState("");
  const [workerEmail, setWorkerEmail] = useState("");
  const [workerPhone, setWorkerPhone] = useState("");
  const [workerPassword, setWorkerPassword] = useState("");
  const [workerRole, setWorkerRole] = useState<"ADMIN" | "STAFF" | "VIEWER">(
    "STAFF",
  );
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: userProfile } = useQuery({
    queryKey: ["settings", "user-profile"],
    queryFn: fetchUserProfile,
  });

  const { data: profile } = useQuery({
    queryKey: ["settings", "business-profile"],
    queryFn: fetchBusinessProfile,
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: fetchSubscriptionStatus,
  });

  const { data: permissions } = useQuery({
    queryKey: ["subscription-permissions"],
    queryFn: fetchUserPermissions,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: fetchWorkers,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });

  const { data: logoUrl } = useQuery({
    queryKey: ["settings", "logo"],
    queryFn: fetchLogoUrl,
  });

  const { data: settingsPrefs } = useQuery({
    queryKey: ["settings", "preferences"],
    queryFn: fetchUserSettingsPreferences,
  });

  const { data: securityActivity = [] } = useQuery({
    queryKey: ["settings", "security-activity"],
    queryFn: fetchSecurityActivity,
  });

  useEffect(() => {
    if (!settingsPrefs) return;

    setAppPrefs({
      currency: settingsPrefs.appPreferences.currency,
      dateFormat: settingsPrefs.appPreferences.dateFormat,
    });
    setNotificationPrefs(settingsPrefs.notifications);
    setBrandingPrefs(settingsPrefs.branding);
    setBackupPrefs(settingsPrefs.backup);

    if (language !== settingsPrefs.appPreferences.language) {
      setLanguage(settingsPrefs.appPreferences.language);
    }
  }, [language, setLanguage, settingsPrefs]);

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.business_name ?? "");
      setGstin(profile.tax_id ?? "");
      setAddressLine1(
        profile.address_line1 ?? profile.businessAddress?.addressLine1 ?? "",
      );
      setCity(profile.city ?? profile.businessAddress?.city ?? "");
      setState(profile.state ?? profile.businessAddress?.state ?? "");
      setPincode(profile.pincode ?? profile.businessAddress?.pincode ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (userProfile?.name) {
      setOwnerName(userProfile.name);
    }
  }, [userProfile]);

  useEffect(() => {
    if (logoUrl !== undefined) {
      setCurrentLogoUrl(logoUrl);
    }
  }, [logoUrl]);

  useEffect(() => {
    if (templates.length > 0 && !brandingPrefs.templateId) {
      setBrandingPrefs((prev) => ({
        ...prev,
        templateId: String(templates[0].id),
      }));
    }
  }, [templates, brandingPrefs.templateId]);

  const toggleSection = (id: SectionKey) => {
    setSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const saveBusinessMutation = useMutation({
    mutationFn: async () => {
      await updateUserProfile({ name: ownerName.trim() });
      await saveBusinessProfile({
        business_name: businessName.trim(),
        tax_id: gstin.trim() || undefined,
        businessAddress: {
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
        },
        currency: appPrefs.currency,
      });
    },
    onSuccess: () => {
      toast.success("Business profile updated.");
      void queryClient.invalidateQueries({
        queryKey: ["settings", "business-profile"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["settings", "user-profile"],
      });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update business profile.";
      toast.error(message);
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: saveUserSettingsPreferences,
    onSuccess: (data) => {
      setAppPrefs({
        currency: data.appPreferences.currency,
        dateFormat: data.appPreferences.dateFormat,
      });
      setNotificationPrefs(data.notifications);
      setBrandingPrefs(data.branding);
      setBackupPrefs(data.backup);
      if (language !== data.appPreferences.language) {
        setLanguage(data.appPreferences.language);
      }
      void queryClient.invalidateQueries({
        queryKey: ["settings", "preferences"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to save preferences.",
      );
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      toast.success("Subscription cancelled.");
      void queryClient.invalidateQueries({ queryKey: ["subscription-status"] });
      void queryClient.invalidateQueries({
        queryKey: ["subscription-permissions"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to cancel subscription.",
      );
    },
  });

  const switchToFreeMutation = useMutation({
    mutationFn: switchToFreePlan,
    onSuccess: () => {
      toast.success("Switched to Free plan.");
      void queryClient.invalidateQueries({ queryKey: ["subscription-status"] });
      void queryClient.invalidateQueries({
        queryKey: ["subscription-permissions"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to switch plan.",
      );
    },
  });

  const upsertWorkerMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: workerName.trim(),
        email: workerEmail.trim(),
        phone: workerPhone.trim(),
        password: workerPassword.trim(),
        accessRole: workerRole,
      } as const;

      if (editingWorkerId) {
        return updateWorker(editingWorkerId, {
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          password: payload.password || undefined,
          accessRole: payload.accessRole,
        });
      }

      if (!payload.password) {
        throw new Error("Password is required for new worker.");
      }

      return createWorker(payload);
    },
    onSuccess: () => {
      toast.success(editingWorkerId ? "Worker updated." : "Worker added.");
      setWorkerName("");
      setWorkerEmail("");
      setWorkerPhone("");
      setWorkerPassword("");
      setWorkerRole("STAFF");
      setEditingWorkerId(null);
      void queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to save worker.",
      );
    },
  });

  const deleteWorkerMutation = useMutation({
    mutationFn: deleteWorker,
    onSuccess: () => {
      toast.success("Worker removed.");
      void queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete worker.",
      );
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      updateUserPassword({
        current_password: currentPassword,
        password: newPassword,
        confirm_password: confirmPassword,
      }),
    onSuccess: () => {
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to update password.",
      );
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (currentLogoUrl) {
        return replaceLogo(file);
      }
      return uploadLogo(file);
    },
    onSuccess: (data) => {
      setCurrentLogoUrl(data.logo_url);
      toast.success("Logo saved.");
      void queryClient.invalidateQueries({ queryKey: ["settings", "logo"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to upload logo.",
      );
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: removeLogo,
    onSuccess: () => {
      setCurrentLogoUrl(null);
      toast.success("Logo removed.");
      void queryClient.invalidateQueries({ queryKey: ["settings", "logo"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove logo.",
      );
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteUserAccount,
    onSuccess: async () => {
      toast.success("Account deleted.");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("token");
      }
      await signOut({ callbackUrl: "/register" });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete account.",
      );
    },
  });

  const logoutAllDevicesMutation = useMutation({
    mutationFn: logoutAllDevices,
    onSuccess: async () => {
      toast.success("All devices logged out successfully.");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("token");
      }
      await signOut({ callbackUrl: "/login" });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to revoke sessions.",
      );
    },
  });

  const usageCopy = useMemo(() => {
    if (!subscription) return "-";

    if (subscription.limits.invoicesPerMonth === null) {
      return `${subscription.usage.invoicesCreated} invoices this month (unlimited)`;
    }

    return `${subscription.usage.invoicesCreated}/${subscription.limits.invoicesPerMonth} invoices this month`;
  }, [subscription]);

  const nextBillingDate = useMemo(() => {
    if (!subscription) return "-";
    if (subscription.status === "TRIAL") {
      return formatDate(subscription.trialEndsAt);
    }
    return formatDate(subscription.currentPeriodEnd);
  }, [subscription]);

  const exportEnabled = permissions?.features.export ?? true;

  const runExport = async (resource: "invoices" | "customers" | "products") => {
    if (permissions && !permissions.features.export) {
      toast.error("Upgrade to Pro to export data.");
      return;
    }

    const resourceFields: Record<typeof resource, string[]> = {
      invoices: ["invoice_number", "customer_name", "status", "date", "total"],
      customers: ["name", "email", "phone", "invoice_count"],
      products: ["name", "sku", "price", "stock_on_hand"],
    };

    try {
      const result = await runDataExport({
        resource,
        format: "csv",
        scope: "all",
        delivery: "download",
        fields: resourceFields[resource],
      });

      if (result.delivery === "download") {
        downloadBlob(result.blob, result.fileName);
        toast.success(`${resource} export downloaded.`);
        return;
      }

      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    }
  };

  const startEditWorker = (worker: Worker) => {
    setEditingWorkerId(worker.id);
    setWorkerName(worker.name);
    setWorkerEmail(worker.email);
    setWorkerPhone(worker.phone ?? "");
    setWorkerPassword("");
    setWorkerRole(
      (worker.roleLabel as "ADMIN" | "STAFF" | "VIEWER") ?? "STAFF",
    );
  };

  const persistAppPrefs = (next: AppPrefs) => {
    setAppPrefs(next);
    saveSettingsMutation.mutate({
      appPreferences: {
        language,
        currency: next.currency,
        dateFormat: next.dateFormat,
      },
    });
  };

  const persistLanguage = (nextLanguage: "en" | "hi") => {
    setLanguage(nextLanguage);
    saveSettingsMutation.mutate({
      appPreferences: {
        language: nextLanguage,
        currency: appPrefs.currency,
        dateFormat: appPrefs.dateFormat,
      },
    });
  };

  const persistNotificationPrefs = (next: NotificationPrefs) => {
    setNotificationPrefs(next);
    saveSettingsMutation.mutate({ notifications: next });
  };

  const persistBrandingPrefs = (next: BrandingPrefs) => {
    setBrandingPrefs(next);
    saveSettingsMutation.mutate({ branding: next });
  };

  const persistBackupPrefs = (next: BackupPrefs) => {
    setBackupPrefs(next);
    saveSettingsMutation.mutate({ backup: next });
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title="Settings"
      subtitle="Business control center for subscription, team, security, branding, and backup workflows."
    >
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <SectionCard
          id="business-profile"
          title="Business Profile"
          description="Core identity details used across invoices, branding, and compliance workflows."
          icon={<Building2 className="size-4" />}
          open={sections["business-profile"]}
          onToggle={toggleSection}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Business Name
              </label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Owner Name
              </label>
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">GSTIN</label>
              <Input
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Address Line
              </label>
              <Input
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">City</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">State</label>
              <Input value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Pincode</label>
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                maxLength={6}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => saveBusinessMutation.mutate()}
              disabled={saveBusinessMutation.isPending}
            >
              <Save className="size-4" /> Save profile
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          id="billing-subscription"
          title="Billing & Subscription"
          description="Transparent plan status, trial visibility, usage, and account billing actions."
          icon={<CreditCard className="size-4" />}
          open={sections["billing-subscription"]}
          onToggle={toggleSection}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Current Plan</p>
              <p className="mt-1 text-sm font-semibold">
                {subscription?.planName ?? "-"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Usage</p>
              <p className="mt-1 text-sm font-semibold">{usageCopy}</p>
            </div>
            <div className="rounded-xl border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Next Billing Date</p>
              <p className="mt-1 text-sm font-semibold">{nextBillingDate}</p>
            </div>
            <div className="rounded-xl border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Trial Status</p>
              <p className="mt-1 text-sm font-semibold">
                {subscription?.status === "TRIAL"
                  ? "Trial active"
                  : "No active trial"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/pricing">Upgrade plan</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => cancelSubscriptionMutation.mutate()}
              disabled={cancelSubscriptionMutation.isPending}
            >
              Cancel subscription
            </Button>
            <Button
              variant="outline"
              onClick={() => switchToFreeMutation.mutate()}
              disabled={switchToFreeMutation.isPending}
            >
              Downgrade to Free
            </Button>
            <Button asChild variant="outline">
              <Link href="/payments">View billing history</Link>
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          id="team-permissions"
          title="Team & Permissions"
          description="Manage worker accounts and role-based access for admins, staff, and viewers."
          icon={<Users className="size-4" />}
          open={sections["team-permissions"]}
          onToggle={toggleSection}
        >
          <div className="grid gap-3 rounded-xl border border-border/70 p-4 md:grid-cols-2">
            <Input
              placeholder="Worker name"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
            />
            <Input
              placeholder="Email"
              value={workerEmail}
              onChange={(e) => setWorkerEmail(e.target.value)}
            />
            <Input
              placeholder="Phone"
              value={workerPhone}
              onChange={(e) => setWorkerPhone(e.target.value)}
            />
            <Input
              placeholder={
                editingWorkerId ? "Password (optional for update)" : "Password"
              }
              value={workerPassword}
              onChange={(e) => setWorkerPassword(e.target.value)}
              type="password"
            />
            <select
              className="app-field h-10 rounded-xl border border-border/70 px-3 text-sm"
              value={workerRole}
              onChange={(e) =>
                setWorkerRole(e.target.value as "ADMIN" | "STAFF" | "VIEWER")
              }
            >
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <div className="flex gap-2">
              <Button
                onClick={() => upsertWorkerMutation.mutate()}
                disabled={upsertWorkerMutation.isPending}
              >
                {editingWorkerId ? "Update worker" : "Add worker"}
              </Button>
              {editingWorkerId ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingWorkerId(null);
                    setWorkerName("");
                    setWorkerEmail("");
                    setWorkerPhone("");
                    setWorkerPassword("");
                    setWorkerRole("STAFF");
                  }}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {workers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No workers added yet.
              </p>
            ) : (
              workers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{worker.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {worker.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Role: {worker.roleLabel ?? worker.role}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditWorker(worker)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteWorkerMutation.mutate(worker.id)}
                      disabled={deleteWorkerMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          id="security"
          title="Security"
          description="Passkeys, password protection, sign-out controls, and login visibility."
          icon={<Shield className="size-4" />}
          open={sections.security}
          onToggle={toggleSection}
        >
          <div className="grid gap-4">
            <PasskeySettingsCard />

            <div className="rounded-xl border border-border/70 p-4">
              <h3 className="text-sm font-semibold">Change password</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => changePasswordMutation.mutate()}
                  disabled={changePasswordMutation.isPending}
                >
                  Update password
                </Button>
                <Button
                  variant="outline"
                  onClick={() => logoutAllDevicesMutation.mutate()}
                  disabled={logoutAllDevicesMutation.isPending}
                >
                  Logout from all devices
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 p-3">
              <p className="text-sm font-semibold">Last login activity</p>
              <div className="mt-2 space-y-2">
                {securityActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No login activity found.
                  </p>
                ) : (
                  securityActivity.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-border/60 bg-muted/20 p-2"
                    >
                      <p className="text-xs font-medium text-foreground">
                        {event.method} • {event.success ? "Success" : "Failed"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(event.createdAt)} •{" "}
                        {event.ipAddress || "IP unavailable"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="data-backup"
          title="Data & Backup"
          description="Export critical records, set backup preference, and protect account ownership."
          icon={<Database className="size-4" />}
          open={sections["data-backup"]}
          onToggle={toggleSection}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              variant="outline"
              onClick={() => void runExport("invoices")}
              disabled={!exportEnabled}
            >
              <Download className="size-4" /> Export invoices
            </Button>
            <Button
              variant="outline"
              onClick={() => void runExport("customers")}
              disabled={!exportEnabled}
            >
              <Download className="size-4" /> Export customers
            </Button>
            <Button
              variant="outline"
              onClick={() => void runExport("products")}
              disabled={!exportEnabled}
            >
              <Download className="size-4" /> Export products
            </Button>
          </div>

          {!exportEnabled ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p>
                Export is not available on your current plan. Upgrade to Pro to
                unlock CSV exports.
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/pricing">Upgrade Now</Link>
              </Button>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            <ToggleRow
              label="Auto backup"
              description="Keep weekly export reminder enabled for safer record retention."
              checked={backupPrefs.autoBackupEnabled}
              onChange={(checked) =>
                persistBackupPrefs({ autoBackupEnabled: checked })
              }
            />
          </div>

          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/60 p-4">
            <p className="text-sm font-semibold text-red-700">Danger zone</p>
            <p className="mt-1 text-xs text-red-700/90">
              Permanently delete your account and all related billing data.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-3">
                  <Trash2 className="size-4" /> Delete account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete account permanently?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All billing records, workers,
                    and settings will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAccountMutation.mutate()}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SectionCard>

        <SectionCard
          id="invoice-branding"
          title="Invoice & Branding"
          description="Control invoice template, logo, theme identity, terms, and signature details."
          icon={<Palette className="size-4" />}
          open={sections["invoice-branding"]}
          onToggle={toggleSection}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Invoice template
              </label>
              <select
                className="app-field h-10 w-full rounded-xl border border-border/70 px-3 text-sm"
                value={brandingPrefs.templateId}
                onChange={(event) =>
                  persistBrandingPrefs({
                    ...brandingPrefs,
                    templateId: event.target.value,
                  })
                }
              >
                {templates.map((template) => (
                  <option key={template.id} value={String(template.id)}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Theme color
              </label>
              <Input
                type="color"
                value={brandingPrefs.themeColor}
                onChange={(event) =>
                  persistBrandingPrefs({
                    ...brandingPrefs,
                    themeColor: event.target.value,
                  })
                }
                className="h-10 p-1"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">
                Terms & conditions
              </label>
              <textarea
                className="app-field min-h-[88px] w-full rounded-xl border border-border/70 px-3 py-2 text-sm"
                value={brandingPrefs.terms}
                onChange={(event) =>
                  persistBrandingPrefs({
                    ...brandingPrefs,
                    terms: event.target.value,
                  })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">
                Signature label
              </label>
              <Input
                value={brandingPrefs.signature}
                onChange={(event) =>
                  persistBrandingPrefs({
                    ...brandingPrefs,
                    signature: event.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/70 p-4">
            <p className="text-sm font-medium">Business logo</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {currentLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentLogoUrl}
                  alt="Business logo"
                  className="h-16 w-16 rounded-lg border border-border/70 object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border/70 text-muted-foreground">
                  <ImageIcon className="size-4" />
                </div>
              )}

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm hover:bg-muted/40">
                <Upload className="size-4" />
                {currentLogoUrl ? "Replace logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      uploadLogoMutation.mutate(file);
                    }
                  }}
                />
              </label>

              <Button
                variant="outline"
                onClick={() => removeLogoMutation.mutate()}
                disabled={!currentLogoUrl || removeLogoMutation.isPending}
              >
                Remove logo
              </Button>

              <Button asChild variant="outline">
                <Link href="/templates">Open advanced template editor</Link>
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="app-preferences"
          title="App Preferences"
          description="Language, currency, and date formats for daily workflow comfort."
          icon={<Languages className="size-4" />}
          open={sections["app-preferences"]}
          onToggle={toggleSection}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Language</label>
              <select
                className="app-field h-10 w-full rounded-xl border border-border/70 px-3 text-sm"
                value={language}
                onChange={(event) =>
                  persistLanguage(event.target.value as "en" | "hi")
                }
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <select
                className="app-field h-10 w-full rounded-xl border border-border/70 px-3 text-sm"
                value={appPrefs.currency}
                onChange={(event) =>
                  persistAppPrefs({
                    ...appPrefs,
                    currency: event.target.value as "INR" | "USD",
                  })
                }
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Date format
              </label>
              <select
                className="app-field h-10 w-full rounded-xl border border-border/70 px-3 text-sm"
                value={appPrefs.dateFormat}
                onChange={(event) =>
                  persistAppPrefs({
                    ...appPrefs,
                    dateFormat: event.target.value as AppPrefs["dateFormat"],
                  })
                }
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="notifications"
          title="Notifications"
          description="Friendly reminder controls for collections, stock, and due invoices."
          icon={<Bell className="size-4" />}
          open={sections.notifications}
          onToggle={toggleSection}
        >
          <div className="grid gap-3">
            <ToggleRow
              label="Payment reminders"
              description="Send nudges for pending payments."
              checked={notificationPrefs.paymentReminders}
              onChange={(checked) =>
                persistNotificationPrefs({
                  ...notificationPrefs,
                  paymentReminders: checked,
                })
              }
            />
            <ToggleRow
              label="Low stock alerts"
              description="Alert when inventory falls below reorder level."
              checked={notificationPrefs.lowStockAlerts}
              onChange={(checked) =>
                persistNotificationPrefs({
                  ...notificationPrefs,
                  lowStockAlerts: checked,
                })
              }
            />
            <ToggleRow
              label="Due invoice alerts"
              description="Prompt before invoice due dates are missed."
              checked={notificationPrefs.dueInvoiceAlerts}
              onChange={(checked) =>
                persistNotificationPrefs({
                  ...notificationPrefs,
                  dueInvoiceAlerts: checked,
                })
              }
            />
          </div>
        </SectionCard>

        <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-xs text-muted-foreground">
          <p>
            Preferences are now synced to your BillSutra account so the same
            configuration follows you across devices.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsControlCenter;
