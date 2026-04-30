"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchBusinessProfile,
  fetchLogoUrl,
  fetchSecurityActivity,
  fetchSecuritySessions,
  fetchSubscriptionStatus,
  fetchTemplates,
  fetchUserPermissions,
  fetchUserProfile,
  fetchUserSettingsPreferences,
  type BusinessProfileRecord,
  type DeviceSessionRecord,
  type SecurityActivityEvent,
  type SubscriptionSnapshot,
  type TemplateRecord,
  type UserPermissions,
  type UserProfile,
  type UserSettingsPreferences,
} from "@/lib/apiClient";

export const workspaceQueryKeys = {
  businessProfile: ["business-profile"] as const,
  subscriptionStatus: ["subscription-status"] as const,
  subscriptionPermissions: ["subscription-permissions"] as const,
  userSettingsPreferences: ["settings", "preferences"] as const,
  userProfile: ["settings", "user-profile"] as const,
  logo: ["settings", "logo"] as const,
  securityActivity: ["settings", "security-activity"] as const,
  securitySessions: ["settings", "security-sessions"] as const,
  templates: ["templates"] as const,
};

export const workspaceQueryStaleTimes = {
  businessProfile: 10 * 60_000,
  subscriptionStatus: 5 * 60_000,
  subscriptionPermissions: 5 * 60_000,
  userSettingsPreferences: 15 * 60_000,
  userProfile: 10 * 60_000,
  logo: 10 * 60_000,
  securityActivity: 60_000,
  securitySessions: 60_000,
  templates: 15 * 60_000,
} as const;

type SharedQueryOptions<TData> = {
  enabled?: boolean;
  initialData?: TData;
};

export const useBusinessProfileQuery = (
  options?: SharedQueryOptions<BusinessProfileRecord | null>,
) =>
  useQuery({
    queryKey: workspaceQueryKeys.businessProfile,
    queryFn: fetchBusinessProfile,
    enabled: options?.enabled,
    initialData: options?.initialData,
    staleTime: workspaceQueryStaleTimes.businessProfile,
  });

export const useSubscriptionStatusQuery = (
  options?: SharedQueryOptions<SubscriptionSnapshot>,
) =>
  useQuery({
    queryKey: workspaceQueryKeys.subscriptionStatus,
    queryFn: fetchSubscriptionStatus,
    enabled: options?.enabled,
    initialData: options?.initialData,
    staleTime: workspaceQueryStaleTimes.subscriptionStatus,
  });

export const useUserPermissionsQuery = (
  options?: SharedQueryOptions<UserPermissions>,
) =>
  useQuery({
    queryKey: workspaceQueryKeys.subscriptionPermissions,
    queryFn: fetchUserPermissions,
    enabled: options?.enabled,
    initialData: options?.initialData,
    staleTime: workspaceQueryStaleTimes.subscriptionPermissions,
  });

export const useUserSettingsPreferencesQuery = (
  options?: SharedQueryOptions<UserSettingsPreferences>,
) =>
  useQuery({
    queryKey: workspaceQueryKeys.userSettingsPreferences,
    queryFn: fetchUserSettingsPreferences,
    enabled: options?.enabled,
    initialData: options?.initialData,
    staleTime: workspaceQueryStaleTimes.userSettingsPreferences,
  });

export const useUserProfileQuery = (
  options?: SharedQueryOptions<UserProfile>,
) =>
  useQuery({
    queryKey: workspaceQueryKeys.userProfile,
    queryFn: fetchUserProfile,
    enabled: options?.enabled,
    initialData: options?.initialData,
    staleTime: workspaceQueryStaleTimes.userProfile,
  });

export const useLogoUrlQuery = (
  options?: SharedQueryOptions<string | null>,
) =>
  useQuery({
    queryKey: workspaceQueryKeys.logo,
    queryFn: fetchLogoUrl,
    enabled: options?.enabled,
    initialData: options?.initialData,
    staleTime: workspaceQueryStaleTimes.logo,
  });

export const useSecurityActivityQuery = (
  options?: SharedQueryOptions<SecurityActivityEvent[]>,
) =>
  useQuery({
    queryKey: workspaceQueryKeys.securityActivity,
    queryFn: fetchSecurityActivity,
    enabled: options?.enabled,
    initialData: options?.initialData,
    staleTime: workspaceQueryStaleTimes.securityActivity,
  });

export const useSecuritySessionsQuery = (
  options?: SharedQueryOptions<DeviceSessionRecord[]>,
) =>
  useQuery({
    queryKey: workspaceQueryKeys.securitySessions,
    queryFn: fetchSecuritySessions,
    enabled: options?.enabled,
    initialData: options?.initialData,
    staleTime: workspaceQueryStaleTimes.securitySessions,
  });

export const useTemplatesQuery = (
  options?: SharedQueryOptions<TemplateRecord[]>,
) =>
  useQuery({
    queryKey: workspaceQueryKeys.templates,
    queryFn: fetchTemplates,
    enabled: options?.enabled,
    initialData: options?.initialData,
    staleTime: workspaceQueryStaleTimes.templates,
  });
