"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  capturePageView,
  identifyAnalyticsUser,
  initProductAnalytics,
  resetAnalyticsUser,
} from "@/lib/observability/client";
import { setFrontendObservabilityUser } from "@/lib/observability/shared";

type SessionUser = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  businessId?: string | null;
  accountType?: string | null;
};

const ObservabilityProvider = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, status } = useSession();

  useEffect(() => {
    initProductAnalytics();
  }, []);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    const user = (data?.user as SessionUser | undefined) ?? null;

    if (status === "authenticated" && user?.id) {
      identifyAnalyticsUser({
        id: user.id,
        email: user.email ?? null,
        name: user.name ?? null,
        role: user.role ?? null,
        businessId: user.businessId ?? null,
        accountType: user.accountType ?? null,
      });
      return;
    }

    setFrontendObservabilityUser(null);
    resetAnalyticsUser();
  }, [data?.user, status]);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    capturePageView(pathname, searchParams.toString());
  }, [pathname, searchParams]);

  return null;
};

export default ObservabilityProvider;
