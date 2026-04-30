"use client";

import posthog from "posthog-js";
import {
  sanitizeObservabilityPayload,
  setFrontendObservabilityUser,
} from "./shared";

const ANALYTICS_OPT_OUT_KEY = "billsutra.analytics.opt_out";

let analyticsInitialized = false;

const getPostHogHost = () =>
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://app.posthog.com";

const isAnalyticsEnabled = () =>
  Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());

const shouldDefaultOptOut = () =>
  process.env.NEXT_PUBLIC_ANALYTICS_OPT_OUT_DEFAULT === "true";

const getStoredOptOut = () => {
  if (typeof window === "undefined") {
    return shouldDefaultOptOut();
  }

  const value = window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY);
  if (value === null) {
    return shouldDefaultOptOut();
  }

  return value === "true";
};

export const initProductAnalytics = () => {
  if (analyticsInitialized || !isAnalyticsEnabled()) {
    return;
  }

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    api_host: getPostHogHost(),
    capture_pageview: false,
    capture_pageleave: "if_capture_pageview",
    autocapture: true,
    person_profiles: "identified_only",
    opt_out_capturing_by_default: shouldDefaultOptOut(),
    loaded: (instance: typeof posthog) => {
      if (getStoredOptOut()) {
        instance.opt_out_capturing();
      }
    },
  });

  analyticsInitialized = true;
};

export const captureAnalyticsEvent = (
  event: string,
  properties?: Record<string, unknown>,
) => {
  if (!isAnalyticsEnabled()) {
    return;
  }

  initProductAnalytics();
  posthog.capture(
    event,
    sanitizeObservabilityPayload(properties) as Record<string, unknown>,
  );
};

export const capturePageView = (pathname: string, search: string) => {
  if (!isAnalyticsEnabled()) {
    return;
  }

  initProductAnalytics();
  posthog.capture("$pageview", {
    pathname,
    search,
    current_url:
      typeof window !== "undefined" ? window.location.href : pathname,
  });
};

export const identifyAnalyticsUser = (user: {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  businessId?: string | null;
  accountType?: string | null;
}) => {
  setFrontendObservabilityUser(user);

  if (!isAnalyticsEnabled()) {
    return;
  }

  initProductAnalytics();
  posthog.identify(user.id, {
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    role: user.role ?? undefined,
    businessId: user.businessId ?? undefined,
    accountType: user.accountType ?? undefined,
  });
};

export const resetAnalyticsUser = () => {
  setFrontendObservabilityUser(null);

  if (!isAnalyticsEnabled()) {
    return;
  }

  initProductAnalytics();
  posthog.reset();
};

export const setAnalyticsOptOut = (optOut: boolean) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ANALYTICS_OPT_OUT_KEY, String(optOut));
  }

  if (!isAnalyticsEnabled()) {
    return;
  }

  initProductAnalytics();
  if (optOut) {
    posthog.opt_out_capturing();
    return;
  }

  posthog.opt_in_capturing();
};
