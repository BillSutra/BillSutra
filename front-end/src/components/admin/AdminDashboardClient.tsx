"use client";

import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { Building2, LayoutDashboard, Shield, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAdminToken } from "@/lib/adminAuth";
import {
  deleteAdminBusiness,
  fetchAdminBusinessDetail,
  fetchAdminBusinesses,
  fetchAdminWorkers,
  type AdminBusinessDetail,
  type AdminBusinessSummary,
  type AdminWorkerRecord,
} from "@/lib/adminApiClient";

type AdminSection = "dashboard" | "businesses" | "workers";

const sections: Array<{
  id: AdminSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "businesses", label: "Businesses", icon: Building2 },
  { id: "workers", label: "Workers", icon: Users },
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(value),
  );

const AdminDashboardClient = () => {
  const router = useRouter();
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [businesses, setBusinesses] = useState<AdminBusinessSummary[]>([]);
  const [workers, setWorkers] = useState<AdminWorkerRecord[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] =
    useState<AdminBusinessDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const selectedBusinessSummary = useMemo(
    () => businesses.find((business) => business.id === selectedBusinessId) ?? null,
    [businesses, selectedBusinessId],
  );

  const loadPanel = async (nextSelectedBusinessId?: string | null) => {
    setError("");
    setIsLoading(true);

    try {
      const [nextBusinesses, nextWorkers] = await Promise.all([
        fetchAdminBusinesses(),
        fetchAdminWorkers(),
      ]);

      setBusinesses(nextBusinesses);
      setWorkers(nextWorkers);

      const resolvedBusinessId =
        nextSelectedBusinessId ??
        selectedBusinessId ??
        nextBusinesses[0]?.id ??
        null;

      setSelectedBusinessId(resolvedBusinessId);

      if (resolvedBusinessId) {
        const detail = await fetchAdminBusinessDetail(resolvedBusinessId);
        setSelectedBusiness(detail);
      } else {
        setSelectedBusiness(null);
      }
    } catch (requestError) {
      if (isAxiosError<{ message?: string }>(requestError)) {
        const status = requestError.response?.status;
        if (status === 401 || status === 403) {
          clearAdminToken();
          router.replace("/admin/login");
          return;
        }

        setError(
          requestError.response?.data?.message ||
            "Unable to load the super admin panel.",
        );
      } else {
        setError("Unable to load the super admin panel.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPanel();
  }, []);

  const handleSelectBusiness = async (businessId: string) => {
    setSelectedBusinessId(businessId);
    setError("");

    try {
      const detail = await fetchAdminBusinessDetail(businessId);
      setSelectedBusiness(detail);
    } catch (requestError) {
      if (isAxiosError<{ message?: string }>(requestError)) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load business details.",
        );
      } else {
        setError("Unable to load business details.");
      }
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    const business = businesses.find((entry) => entry.id === businessId);
    const confirmed = window.confirm(
      `Delete ${business?.name || "this business"} and its related tenant data?`,
    );

    if (!confirmed) return;

    setIsDeleting(businessId);
    setError("");

    try {
      await deleteAdminBusiness(businessId);
      const fallbackBusinessId =
        selectedBusinessId === businessId ? null : selectedBusinessId;
      await loadPanel(fallbackBusinessId);
    } catch (requestError) {
      if (isAxiosError<{ message?: string }>(requestError)) {
        setError(
          requestError.response?.data?.message ||
            "Unable to delete this business right now.",
        );
      } else {
        setError("Unable to delete this business right now.");
      }
    } finally {
      setIsDeleting(null);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    router.replace("/admin/login");
  };

  return (
    <div className="min-h-screen bg-[#f4ede2] text-[#1f1b16]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-[#e7d7c4] bg-[#1f1b16] px-5 py-6 text-white lg:flex lg:flex-col">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[#f4c98d]">
              Bill Sutra
            </p>
            <h1 className="mt-3 font-[var(--font-fraunces)] text-3xl leading-tight">
              Super Admin
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Platform-wide visibility for businesses, workers, and tenant cleanup.
            </p>
          </div>

          <nav className="mt-8 grid gap-2">
            {sections.map((entry) => {
              const Icon = entry.icon;
              const active = section === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSection(entry.id)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                    active
                      ? "bg-[#f4c98d] text-[#1f1b16]"
                      : "text-white/72 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon className="size-4" />
                  {entry.label}
                </button>
              );
            })}
          </nav>

          <Button
            variant="outline"
            className="mt-auto border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={handleLogout}
          >
            Sign out
          </Button>
        </aside>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-[#e8d9c7] bg-white px-5 py-5 shadow-[0_20px_60px_rgba(52,32,17,0.08)] sm:px-6">
            <div className="flex flex-col gap-4 border-b border-[#f1e5d8] pb-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#8a6d56]">
                  Secure Admin Surface
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  {section === "dashboard"
                    ? "Platform Dashboard"
                    : section === "businesses"
                      ? "Business Directory"
                      : "Worker Directory"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d5948]">
                  Super-admin routes are isolated from the normal user app and use a
                  dedicated JWT guard.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 lg:hidden">
                {sections.map((entry) => {
                  const active = section === entry.id;
                  return (
                    <Button
                      key={entry.id}
                      variant={active ? "default" : "outline"}
                      onClick={() => setSection(entry.id)}
                    >
                      {entry.label}
                    </Button>
                  );
                })}
                <Button variant="outline" onClick={handleLogout}>
                  Sign out
                </Button>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-[#f2d6b2] bg-[#fff8ef] px-4 py-3 text-sm text-[#9a4d0f]">
                {error}
              </div>
            ) : null}

            {isLoading ? (
              <div className="mt-8 rounded-3xl border border-dashed border-[#ead7c3] px-6 py-10 text-sm text-[#7e6652]">
                Loading super admin data...
              </div>
            ) : null}

            {!isLoading ? (
              <>
                {section === "dashboard" ? (
                  <div className="mt-8 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-3xl border border-[#f0e2d2] bg-[#fff9f3] p-5">
                        <div className="flex items-center gap-3">
                          <Shield className="size-5 text-[#8a5a2b]" />
                          <p className="text-sm font-semibold text-[#5e4532]">
                            Businesses
                          </p>
                        </div>
                        <p className="mt-3 text-4xl font-semibold tracking-tight">
                          {businesses.length}
                        </p>
                        <p className="mt-2 text-sm text-[#7d6652]">
                          Active tenant records in the platform directory.
                        </p>
                      </div>

                      <div className="rounded-3xl border border-[#f0e2d2] bg-[#fff9f3] p-5">
                        <div className="flex items-center gap-3">
                          <Users className="size-5 text-[#8a5a2b]" />
                          <p className="text-sm font-semibold text-[#5e4532]">
                            Workers
                          </p>
                        </div>
                        <p className="mt-3 text-4xl font-semibold tracking-tight">
                          {workers.length}
                        </p>
                        <p className="mt-2 text-sm text-[#7d6652]">
                          Total workers across all businesses.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[#f0e2d2] bg-white p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#5e4532]">
                            Latest businesses
                          </p>
                          <p className="text-sm text-[#7d6652]">
                            Review recent tenant creations and drill into details.
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => setSection("businesses")}>
                          Open directory
                        </Button>
                      </div>

                      <div className="mt-5 overflow-hidden rounded-2xl border border-[#f1e5d8]">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-[#fbf5ee] text-[#7d6652]">
                            <tr>
                              <th className="px-4 py-3 font-medium">Business</th>
                              <th className="px-4 py-3 font-medium">Owner</th>
                              <th className="px-4 py-3 font-medium">Workers</th>
                              <th className="px-4 py-3 font-medium">Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {businesses.slice(0, 6).map((business) => (
                              <tr
                                key={business.id}
                                className="cursor-pointer border-t border-[#f5eadf] hover:bg-[#fffaf5]"
                                onClick={() => {
                                  setSection("businesses");
                                  void handleSelectBusiness(business.id);
                                }}
                              >
                                <td className="px-4 py-3 font-medium">{business.name}</td>
                                <td className="px-4 py-3">{business.ownerId}</td>
                                <td className="px-4 py-3">{business.workerCount}</td>
                                <td className="px-4 py-3">
                                  {formatDate(business.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : null}

                {section === "businesses" ? (
                  <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="overflow-hidden rounded-3xl border border-[#f0e2d2] bg-white">
                      <div className="flex items-center justify-between border-b border-[#f1e5d8] px-5 py-4">
                        <div>
                          <p className="text-sm font-semibold text-[#5e4532]">
                            All businesses
                          </p>
                          <p className="text-sm text-[#7d6652]">
                            Select a business to inspect the tenant.
                          </p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-[#fbf5ee] text-[#7d6652]">
                            <tr>
                              <th className="px-5 py-3 font-medium">Name</th>
                              <th className="px-5 py-3 font-medium">Owner</th>
                              <th className="px-5 py-3 font-medium">Workers</th>
                              <th className="px-5 py-3 font-medium">Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {businesses.map((business) => (
                              <tr
                                key={business.id}
                                className={`cursor-pointer border-t border-[#f5eadf] ${
                                  selectedBusinessId === business.id
                                    ? "bg-[#fff7ed]"
                                    : "hover:bg-[#fffaf5]"
                                }`}
                                onClick={() => void handleSelectBusiness(business.id)}
                              >
                                <td className="px-5 py-4 font-medium">{business.name}</td>
                                <td className="px-5 py-4">{business.ownerId}</td>
                                <td className="px-5 py-4">{business.workerCount}</td>
                                <td className="px-5 py-4">
                                  {formatDate(business.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[#f0e2d2] bg-[#fff9f3] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#5e4532]">
                            Business details
                          </p>
                          <p className="text-sm text-[#7d6652]">
                            Deep view into the selected tenant.
                          </p>
                        </div>
                        {selectedBusinessSummary ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDeleteBusiness(selectedBusinessSummary.id)}
                            disabled={isDeleting === selectedBusinessSummary.id}
                          >
                            <Trash2 className="size-4" />
                            {isDeleting === selectedBusinessSummary.id
                              ? "Deleting..."
                              : "Delete business"}
                          </Button>
                        ) : null}
                      </div>

                      {selectedBusiness ? (
                        <div className="mt-5 space-y-5">
                          <div className="rounded-2xl border border-[#eadaca] bg-white p-4">
                            <p className="text-lg font-semibold">{selectedBusiness.name}</p>
                            <p className="mt-1 text-sm text-[#6f5846]">
                              Owner ID: {selectedBusiness.ownerId}
                            </p>
                            <p className="text-sm text-[#6f5846]">
                              Created: {formatDate(selectedBusiness.createdAt)}
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            {[
                              ["Workers", selectedBusiness.stats.workerCount],
                              ["Sales", selectedBusiness.stats.salesCount],
                              ["Invoices", selectedBusiness.stats.invoiceCount],
                              ["Purchases", selectedBusiness.stats.purchaseCount],
                              ["Products", selectedBusiness.stats.productCount],
                              ["Customers", selectedBusiness.stats.customerCount],
                            ].map(([label, value]) => (
                              <div
                                key={label}
                                className="rounded-2xl border border-[#eadaca] bg-white px-4 py-3"
                              >
                                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                                  {label}
                                </p>
                                <p className="mt-2 text-2xl font-semibold">{value}</p>
                              </div>
                            ))}
                          </div>

                          <div className="rounded-2xl border border-[#eadaca] bg-white p-4">
                            <p className="text-sm font-semibold text-[#5e4532]">
                              Owner account
                            </p>
                            <div className="mt-3 grid gap-2 text-sm text-[#6f5846]">
                              <p>Name: {selectedBusiness.owner?.name || "-"}</p>
                              <p>Email: {selectedBusiness.owner?.email || "-"}</p>
                              <p>Provider: {selectedBusiness.owner?.provider || "-"}</p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-[#eadaca] bg-white p-4">
                            <p className="text-sm font-semibold text-[#5e4532]">
                              Business profile
                            </p>
                            <div className="mt-3 grid gap-2 text-sm text-[#6f5846]">
                              <p>
                                Phone: {selectedBusiness.businessProfile?.phone || "-"}
                              </p>
                              <p>
                                Email: {selectedBusiness.businessProfile?.email || "-"}
                              </p>
                              <p>
                                Website: {selectedBusiness.businessProfile?.website || "-"}
                              </p>
                              <p>
                                Currency: {selectedBusiness.businessProfile?.currency || "-"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-[#eadaca] bg-white p-4">
                            <p className="text-sm font-semibold text-[#5e4532]">
                              Workers
                            </p>
                            <div className="mt-4 grid gap-3">
                              {selectedBusiness.workers.length === 0 ? (
                                <p className="text-sm text-[#7d6652]">
                                  No workers linked to this business.
                                </p>
                              ) : (
                                selectedBusiness.workers.map((worker) => (
                                  <div
                                    key={worker.id}
                                    className="rounded-2xl border border-[#f0e2d2] bg-[#fffaf5] px-4 py-3"
                                  >
                                    <p className="font-medium">{worker.name}</p>
                                    <p className="text-sm text-[#6f5846]">{worker.email}</p>
                                    <p className="text-sm text-[#6f5846]">
                                      {worker.phone || "-"}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5 rounded-2xl border border-dashed border-[#eadaca] px-4 py-10 text-sm text-[#7d6652]">
                          Select a business to inspect its full details.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {section === "workers" ? (
                  <div className="mt-8 overflow-hidden rounded-3xl border border-[#f0e2d2] bg-white">
                    <div className="border-b border-[#f1e5d8] px-5 py-4">
                      <p className="text-sm font-semibold text-[#5e4532]">
                        Workers across all businesses
                      </p>
                      <p className="text-sm text-[#7d6652]">
                        Platform-wide worker visibility for audit and support.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[#fbf5ee] text-[#7d6652]">
                          <tr>
                            <th className="px-5 py-3 font-medium">Name</th>
                            <th className="px-5 py-3 font-medium">Email</th>
                            <th className="px-5 py-3 font-medium">Phone</th>
                            <th className="px-5 py-3 font-medium">Role</th>
                            <th className="px-5 py-3 font-medium">Business</th>
                            <th className="px-5 py-3 font-medium">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workers.map((worker) => (
                            <tr key={worker.id} className="border-t border-[#f5eadf]">
                              <td className="px-5 py-4 font-medium">{worker.name}</td>
                              <td className="px-5 py-4">{worker.email}</td>
                              <td className="px-5 py-4">{worker.phone || "-"}</td>
                              <td className="px-5 py-4">{worker.role}</td>
                              <td className="px-5 py-4">{worker.business.name}</td>
                              <td className="px-5 py-4">
                                {formatDate(worker.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboardClient;
