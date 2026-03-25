"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import AppSidebar from "./AppSidebar";
import TopNavbar from "./TopNavbar";

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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
            collapsed ? "lg:ml-20" : "lg:ml-64",
          )}
        >
          <TopNavbar
            name={name}
            image={image}
            onOpenMobileMenu={() => setMobileOpen(true)}
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
    </div>
  );
};

export default DashboardLayout;
