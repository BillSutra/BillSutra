"use client";

import axios, { isAxiosError, type AxiosRequestConfig } from "axios";
import { API_URL, ADMIN_LOGIN_URL } from "./apiEndPoints";
import { clearAdminToken, getStoredAdminToken } from "./adminAuth";
import { buildRequiredCsrfHeaders } from "./csrfClient";

export type AdminSessionUser = {
  adminId: string;
  email: string;
  role: "SUPER_ADMIN";
};

export type AdminLoginResponse = {
  user: AdminSessionUser;
  token: string;
  expiresAt?: number;
};

export type AdminBusinessSummary = {
  id: string;
  name: string;
  ownerId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  createdAt: string;
  workerCount: number;
};

export type AdminSummaryResponse = {
  totals: {
    totalBusinesses: number;
    totalWorkers: number;
    activeBusinesses: number;
    zeroWorkerBusinesses: number;
    businessesCreatedLast7Days: number;
    workersCreatedLast7Days: number;
    adminWorkers: number;
    averageWorkersPerBusiness: number;
  };
  topBusinessesByWorkers: Array<{
    id: string;
    name: string;
    ownerId: string;
    createdAt: string;
    workerCount: number;
  }>;
};

export type AdminWorkerRecord = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "ADMIN" | "WORKER";
  businessId: string;
  createdAt: string;
  business: {
    name: string;
    ownerId: string;
  };
};

export type AdminBusinessDetail = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  owner: {
    id: number;
    name: string;
    email: string;
    provider: string;
    created_at: string;
  } | null;
  businessProfile: {
    business_name?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    currency?: string | null;
  } | null;
  workers: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: "ADMIN" | "WORKER";
    createdAt: string;
  }>;
  stats: {
    workerCount: number;
    salesCount: number;
    invoiceCount: number;
    purchaseCount: number;
    productCount: number;
    customerCount: number;
    supplierCount: number;
  };
};

export type AdminAccessPaymentRecord = {
  id: string;
  userId: number;
  planId: "pro" | "pro-plus";
  billingCycle: "monthly" | "yearly";
  method: "upi";
  amount: number;
  status: "pending" | "approved" | "rejected" | "success";
  name?: string | null;
  utr?: string | null;
  proofFileId?: string | null;
  proofUrl?: string | null;
  proofMimeType?: string | null;
  proofOriginalName?: string | null;
  proofSize?: number | null;
  proofUploadedAt?: string | null;
  screenshotUrl?: string | null;
  adminNote?: string | null;
  provider?: string | null;
  providerReference?: string | null;
  reviewedByAdminId?: string | null;
  reviewedByAdminEmail?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null;
};

type AdminRequestOptions = {
  signal?: AbortSignal;
  force?: boolean;
};

type AdminApiRequestConfig = AxiosRequestConfig & {
  _adminRetry?: boolean;
  skipAdminRefresh?: boolean;
};

const ADMIN_SESSION_CACHE_TTL_MS = 15_000;

const adminApiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let adminSessionCache:
  | {
      user: AdminSessionUser;
      cachedAt: number;
    }
  | null = null;
let adminSessionRequestInFlight: Promise<AdminSessionUser> | null = null;
let adminRefreshRequestInFlight: Promise<boolean> | null = null;
const adminAuthInvalidationListeners = new Set<() => void>();

const isAdminAuthRoute = (url?: string) =>
  typeof url === "string" &&
  (url.includes("/admin/login") || url.includes("/admin/refresh"));

const isAdminRequestCanceled = (error: unknown) =>
  isAxiosError(error) && error.code === "ERR_CANCELED";

export const isAdminUnauthorizedError = (error: unknown) =>
  isAxiosError(error) &&
  [401, 403].includes(Number(error.response?.status ?? 0));

const notifyAdminAuthInvalidated = () => {
  adminAuthInvalidationListeners.forEach((listener) => listener());
};

const setAdminSessionCache = (user: AdminSessionUser) => {
  adminSessionCache = {
    user,
    cachedAt: Date.now(),
  };
};

const shouldUseCachedAdminSession = () =>
  !!adminSessionCache &&
  Date.now() - adminSessionCache.cachedAt < ADMIN_SESSION_CACHE_TTL_MS;

export const clearAdminAuthState = () => {
  adminSessionCache = null;
  adminSessionRequestInFlight = null;
  clearAdminToken();
};

export const subscribeToAdminAuthInvalidation = (listener: () => void) => {
  adminAuthInvalidationListeners.add(listener);

  return () => {
    adminAuthInvalidationListeners.delete(listener);
  };
};

const refreshAdminSession = async () => {
  if (!adminRefreshRequestInFlight) {
    adminRefreshRequestInFlight = (async () => {
      try {
        const csrfHeaders = await buildRequiredCsrfHeaders();
        const response = await axios.post(
          `${API_URL}/admin/refresh`,
          {},
          {
            withCredentials: true,
            headers: csrfHeaders,
          },
        );

        const nextUser = response.data?.data?.user as AdminSessionUser | undefined;
        if (nextUser) {
          setAdminSessionCache(nextUser);
        }

        return true;
      } catch (error) {
        clearAdminAuthState();
        if (!isAdminRequestCanceled(error)) {
          notifyAdminAuthInvalidated();
        }
        return false;
      } finally {
        adminRefreshRequestInFlight = null;
      }
    })();
  }

  return adminRefreshRequestInFlight;
};

adminApiClient.interceptors.request.use((config) => {
  config.withCredentials = true;

  if (typeof window !== "undefined") {
    const token = getStoredAdminToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
    }
  }

  return config;
});

adminApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isAdminRequestCanceled(error)) {
      return Promise.reject(error);
    }

    const status = Number(error?.response?.status ?? 0);
    const originalConfig = error?.config as AdminApiRequestConfig | undefined;

    if (
      [401, 403].includes(status) &&
      originalConfig &&
      !originalConfig._adminRetry &&
      !originalConfig.skipAdminRefresh &&
      !isAdminAuthRoute(originalConfig.url)
    ) {
      originalConfig._adminRetry = true;
      const refreshed = await refreshAdminSession();

      if (refreshed) {
        return adminApiClient.request(originalConfig);
      }
    }

    if ([401, 403].includes(status)) {
      clearAdminAuthState();
      notifyAdminAuthInvalidated();
    }

    return Promise.reject(error);
  },
);

const getAdmin = async <T>(
  path: string,
  options?: AdminRequestOptions,
): Promise<T> => {
  const response = await adminApiClient.get(path, {
    signal: options?.signal,
  });
  return response.data.data as T;
};

const patchAdmin = async <T>(
  path: string,
  body?: unknown,
  options?: AdminRequestOptions,
): Promise<T> => {
  const response = await adminApiClient.patch(path, body, {
    signal: options?.signal,
  });
  return response.data.data as T;
};

const deleteAdmin = async <T>(
  path: string,
  options?: AdminRequestOptions,
): Promise<T> => {
  const response = await adminApiClient.delete(path, {
    signal: options?.signal,
  });
  return response.data.data as T;
};

export const loginSuperAdmin = async (payload: {
  email: string;
  password: string;
}) => {
  clearAdminAuthState();
  const response = await axios.post(ADMIN_LOGIN_URL, payload, {
    withCredentials: true,
  });
  const data = response.data.data as AdminLoginResponse;
  setAdminSessionCache(data.user);
  return data;
};

export const fetchAdminSession = async (options?: AdminRequestOptions) => {
  if (!options?.force && shouldUseCachedAdminSession() && adminSessionCache) {
    return adminSessionCache.user;
  }

  if (!options?.force && adminSessionRequestInFlight) {
    return adminSessionRequestInFlight;
  }

  const request = getAdmin<{
    user: AdminSessionUser;
    expiresAt?: number;
  }>("/admin/session", options)
    .then((data) => {
      setAdminSessionCache(data.user);
      return data.user;
    })
    .finally(() => {
      if (adminSessionRequestInFlight === request) {
        adminSessionRequestInFlight = null;
      }
    });

  adminSessionRequestInFlight = request;
  return request;
};

export const logoutSuperAdmin = async () => {
  try {
    const csrfHeaders = await buildRequiredCsrfHeaders();
    await adminApiClient.post(
      "/admin/logout",
      {},
      {
        headers: csrfHeaders,
        skipAdminRefresh: true,
      } as AdminApiRequestConfig,
    );
  } finally {
    clearAdminAuthState();
  }
};

export const fetchAdminBusinesses = async (options?: AdminRequestOptions) =>
  getAdmin<AdminBusinessSummary[]>("/admin/businesses", options);

export const fetchAdminSummary = async (options?: AdminRequestOptions) =>
  getAdmin<AdminSummaryResponse>("/admin/summary", options);

export const fetchAdminBusinessDetail = async (
  businessId: string,
  options?: AdminRequestOptions,
) => getAdmin<AdminBusinessDetail>(`/admin/business/${businessId}`, options);

export const deleteAdminBusiness = async (
  businessId: string,
  options?: AdminRequestOptions,
) => deleteAdmin<undefined>(`/admin/business/${businessId}`, options);

export const fetchAdminWorkers = async (options?: AdminRequestOptions) =>
  getAdmin<AdminWorkerRecord[]>("/admin/workers", options);

export const fetchAdminPayments = async (options?: AdminRequestOptions) =>
  getAdmin<AdminAccessPaymentRecord[]>("/admin/payments", options);

export const approveAdminPayment = async (
  payload: {
    paymentId: string;
    adminNote?: string;
  },
  options?: AdminRequestOptions,
) =>
  patchAdmin<AdminAccessPaymentRecord>(
    `/admin/payments/${payload.paymentId}/approve`,
    payload.adminNote?.trim() ? { adminNote: payload.adminNote.trim() } : {},
    options,
  );

export const rejectAdminPayment = async (
  payload: {
    paymentId: string;
    adminNote?: string;
  },
  options?: AdminRequestOptions,
) =>
  patchAdmin<AdminAccessPaymentRecord>(
    `/admin/payments/${payload.paymentId}/reject`,
    payload.adminNote?.trim() ? { adminNote: payload.adminNote.trim() } : {},
    options,
  );

export { isAdminRequestCanceled };
