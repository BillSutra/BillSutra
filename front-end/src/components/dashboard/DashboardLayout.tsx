"use client";

import { startTransition, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AppSidebar from "./AppSidebar";
import TopNavbar from "./TopNavbar";
import BeginnerOnboardingModal from "@/components/onboarding/BeginnerOnboardingModal";
import HelpCenterDialog from "@/components/help/HelpCenterDialog";
import {
  getBeginnerState,
  invalidateBeginnerQueries,
  markOnboardingSeen,
  resetBeginnerExperience,
  seedDemoWorkspace,
} from "@/lib/firstRun";

const BillSutraAssistant = dynamic(
  () => import("@/components/assistant/BillSutraAssistant"),
  { ssr: false },
);

type DashboardLayoutProps = {
  name: string;
  image?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

const DashboardLayout = ({
  name,
  image,
  title,
  subtitle,
  actions,
  children,
}: DashboardLayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [demoSeeded, setDemoSeeded] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [assistantReady, setAssistantReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const state = getBeginnerState();
    setDemoSeeded(state.demoSeeded);
    setOnboardingOpen(!state.onboardingSeen);
  }, []);

  useEffect(() => {
    const routesToPrefetch = [
      "/dashboard",
      "/simple-bill",
      "/invoices",
      "/invoices/history",
      "/products",
      "/customers",
      "/settings",
      "/notifications",
    ].filter((route) => route !== pathname);

    const supportsIdleCallback =
      typeof window !== "undefined" &&
      typeof window.requestIdleCallback === "function" &&
      typeof window.cancelIdleCallback === "function";

    const runPrefetch = () => {
      startTransition(() => {
        routesToPrefetch.forEach((route) => {
          void router.prefetch(route);
        });
        setAssistantReady(true);
      });
    };

    const handle = supportsIdleCallback
      ? window.requestIdleCallback(runPrefetch, { timeout: 1200 })
      : window.setTimeout(runPrefetch, 450);

    return () => {
      if (!supportsIdleCallback) {
        window.clearTimeout(handle);
        return;
      }

      window.cancelIdleCallback(handle);
    };
  }, [pathname, router]);

  const handleCompleteOnboarding = () => {
    markOnboardingSeen();
    setOnboardingOpen(false);
  };

  const handleReplayOnboarding = () => {
    resetBeginnerExperience();
    setDemoSeeded(false);
    setHelpOpen(false);
    setOnboardingOpen(true);
  };

  const handleSeedDemo = async () => {
    if (isSeedingDemo) return;

    try {
      setIsSeedingDemo(true);
      await seedDemoWorkspace();
      await invalidateBeginnerQueries(queryClient);
      setDemoSeeded(true);
      toast.success("Sample data is ready. You can edit or delete it anytime.");
      markOnboardingSeen();
      setOnboardingOpen(false);
    } catch {
      toast.error("Could not load sample data right now. Please try again.");
    } finally {
      setIsSeedingDemo(false);
    }
  };

  return (
    <div className="dashboard-root h-screen overflow-hidden bg-slate-50 text-foreground dark:bg-zinc-950">
      <div className="flex h-screen overflow-hidden">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((prev) => !prev)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col transition-[margin] duration-200",
            collapsed ? "lg:ml-20" : "lg:ml-[270px]",
          )}
        >
          <TopNavbar
            name={name}
            image={image}
            onOpenMobileMenu={() => setMobileOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
          />

          <main className="app-scrollbar page-fade-in dashboard-grid min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:p-6 xl:p-8">
            <section className="mx-auto mb-6 flex w-full max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-4xl">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[0.98rem]">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              {actions ? (
                <div className="flex w-full lg:w-auto lg:justify-end">{actions}</div>
              ) : null}
            </section>

            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>

      <BeginnerOnboardingModal
        open={onboardingOpen}
        onOpenChange={(open) => {
          setOnboardingOpen(open);
          if (!open) {
            markOnboardingSeen();
          }
        }}
        onComplete={handleCompleteOnboarding}
        onSeedDemo={() => void handleSeedDemo()}
        isSeedingDemo={isSeedingDemo}
        demoSeeded={demoSeeded}
      />

      <HelpCenterDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        onReplayOnboarding={handleReplayOnboarding}
        onSeedDemo={() => void handleSeedDemo()}
        isSeedingDemo={isSeedingDemo}
        demoSeeded={demoSeeded}
      />

      {assistantReady ? <BillSutraAssistant /> : null}
    </div>
  );
};

export default DashboardLayout;
