"use client";

import axios from "axios";
import { API_URL, ADMIN_LOGIN_URL } from "./apiEndPoints";
import { getStoredAdminToken } from "./adminAuth";

export type AdminLoginResponse = {
  user: {
    adminId: string;
    email: string;
    role: "SUPER_ADMIN";
  };
  token: string;
};

export type AdminBusinessSummary = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  workerCount: number;
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

const adminApiClient = axios.create({
  baseURL: API_URL,
});

adminApiClient.interceptors.request.use((config) => {
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

export const loginSuperAdmin = async (payload: {
  email: string;
  password: string;
}) => {
  const response = await axios.post(ADMIN_LOGIN_URL, payload);
  return response.data.data as AdminLoginResponse;
};

export const fetchAdminBusinesses = async () => {
  const response = await adminApiClient.get("/admin/businesses");
  return response.data.data as AdminBusinessSummary[];
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
