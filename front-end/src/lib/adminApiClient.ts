"use client";

import axios from "axios";
import { API_URL, ADMIN_LOGIN_URL } from "./apiEndPoints";
import { clearAdminToken, getStoredAdminToken } from "./adminAuth";

export type AdminLoginResponse = {
  user: {
    adminId: string;
    email: string;
    role: "SUPER_ADMIN";
  };
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

const adminApiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

adminApiClient.interceptors.request.use((config) => {
  config.withCredentials = true;

  if (typeof window !== "undefined") {
    const token = getStoredAdminToken();
    if (token) {
      config.headers.Authorization = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
    }
  }

  return config;
});

adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      const status = Number(error?.response?.status ?? 0);
      if (status === 401 || status === 403) {
        clearAdminToken();
        if (!window.location.pathname.startsWith("/admin/login")) {
          window.location.assign("/admin/login");
        }
      }
    }

    return Promise.reject(error);
  },
);

export const loginSuperAdmin = async (payload: {
  email: string;
  password: string;
}) => {
  const response = await axios.post(ADMIN_LOGIN_URL, payload, {
    withCredentials: true,
  });
  return response.data.data as AdminLoginResponse;
};

export const logoutSuperAdmin = async () => {
  await adminApiClient.post("/admin/logout");
};

export const fetchAdminBusinesses = async () => {
  const response = await adminApiClient.get("/admin/businesses");
  return response.data.data as AdminBusinessSummary[];
};

export const fetchAdminSummary = async () => {
  const response = await adminApiClient.get("/admin/summary");
  return response.data.data as AdminSummaryResponse;
};

export const fetchAdminBusinessDetail = async (businessId: string) => {
  const response = await adminApiClient.get(`/admin/business/${businessId}`);
  return response.data.data as AdminBusinessDetail;
};

export const deleteAdminBusiness = async (businessId: string) => {
  await adminApiClient.delete(`/admin/business/${businessId}`);
};

export const fetchAdminWorkers = async () => {
  const response = await adminApiClient.get("/admin/workers");
  return response.data.data as AdminWorkerRecord[];
};

export const fetchAdminPayments = async () => {
  const response = await adminApiClient.get("/admin/payments");
  return response.data.data as AdminAccessPaymentRecord[];
};

export const approveAdminPayment = async (payload: {
  paymentId: string;
  adminNote?: string;
}) => {
  const response = await adminApiClient.patch(
    `/admin/payments/${payload.paymentId}/approve`,
    payload.adminNote?.trim() ? { adminNote: payload.adminNote.trim() } : {},
  );
  return response.data.data as AdminAccessPaymentRecord;
};

export const rejectAdminPayment = async (payload: {
  paymentId: string;
  adminNote?: string;
}) => {
  const response = await adminApiClient.patch(
    `/admin/payments/${payload.paymentId}/reject`,
    payload.adminNote?.trim() ? { adminNote: payload.adminNote.trim() } : {},
  );
  return response.data.data as AdminAccessPaymentRecord;
};
