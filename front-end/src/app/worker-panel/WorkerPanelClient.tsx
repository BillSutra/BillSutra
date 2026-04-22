"use client";

import React from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import WorkerProfileSection from "@/components/worker-panel/WorkerProfileSection";
import WorkerChangePassword from "@/components/worker-panel/WorkerChangePassword";
import WorkerPerformanceSection from "@/components/worker-panel/WorkerPerformanceSection";
import WorkerIncentiveSection from "@/components/worker-panel/WorkerIncentiveSection";
import WorkerHistorySection from "@/components/worker-panel/WorkerHistorySection";
import { useI18n } from "@/providers/LanguageProvider";

type WorkerPanelClientProps = {
  name: string;
  image?: string;
};

const WorkerPanelClient = ({ name, image }: WorkerPanelClientProps) => {
  const { safeT } = useI18n();

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={safeT("workerPanel.title", "Worker Panel")}
      subtitle={safeT(
        "workerPanel.subtitle",
        "Manage your profile and track your performance",
      )}
    >
      <div className="space-y-8 px-4 pb-12 pt-4">
        <WorkerProfileSection />
        <WorkerChangePassword />
        <WorkerPerformanceSection />
        <WorkerIncentiveSection />
        <WorkerHistorySection />
      </div>
    </DashboardLayout>
  );
};

export default WorkerPanelClient;
