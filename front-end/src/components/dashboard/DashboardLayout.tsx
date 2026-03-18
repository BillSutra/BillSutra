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

          <main className="page-fade-in dashboard-grid flex-1 px-4 py-6 sm:px-6">
            <section className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              {actions ? (
                <div className="flex items-center gap-2">{actions}</div>
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
