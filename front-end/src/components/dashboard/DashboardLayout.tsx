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
    <div className="dashboard-root min-h-screen text-foreground">
      <div className="flex min-h-screen">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((prev) => !prev)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div
          className={cn(
            "flex min-h-screen min-w-0 flex-1 flex-col transition-[margin] duration-200",
            collapsed ? "lg:ml-20" : "lg:ml-60",
          )}
        >
          <TopNavbar
            name={name}
            image={image}
            onOpenMobileMenu={() => setMobileOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
          />

          <main className="page-fade-in dashboard-grid flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-4xl">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.35rem]">
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

            {children}
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
