"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import SessionProvider from "@/providers/sessionProvider";
import QueryProvider from "@/providers/QueryProvider";
import AuthTokenSync from "@/providers/AuthTokenSync";
import AuthSessionGuard from "@/providers/AuthSessionGuard";
import RealtimeInvoiceProvider from "@/providers/RealtimeInvoiceProvider";
import { NotificationProvider } from "@/providers/NotificationProvider";
import ObservabilityProvider from "@/providers/ObservabilityProvider";
import UpgradePromptDialog from "@/components/subscription/UpgradePromptDialog";
import { Toaster } from "@/components/ui/sonner";

const AppRuntimeProviders = ({
  children,
}: {
  children: ReactNode;
}) => {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  if (isAdminRoute) {
    return (
      <QueryProvider>
        {children}
        <Toaster richColors duration={10000} />
      </QueryProvider>
    );
  }

  return (
    <SessionProvider>
      <QueryProvider>
        <NotificationProvider>
          <AuthTokenSync />
          <AuthSessionGuard />
          <RealtimeInvoiceProvider />
          <ObservabilityProvider />
          <UpgradePromptDialog />
          {children}
          <Toaster richColors duration={10000} />
        </NotificationProvider>
      </QueryProvider>
    </SessionProvider>
  );
};

export default AppRuntimeProviders;
