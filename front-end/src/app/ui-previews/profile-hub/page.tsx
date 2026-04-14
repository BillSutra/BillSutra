import { notFound } from "next/navigation";
import ProfileClient from "@/components/profile/ProfileClient";

const nowIso = new Date("2026-04-13T10:30:00.000Z").toISOString();

const ProfileHubPreviewPage = () => {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <ProfileClient
      initialProfile={{
        id: 101,
        name: "Aarav Sharma",
        email: "aarav@example.com",
        provider: "credentials",
        image: null,
        is_email_verified: true,
      }}
      previewData={{
        businessProfile: {
          id: 19,
          user_id: 101,
          business_name: "Sunrise Traders",
          address: "12 Market Road, Jaipur, Rajasthan, 302001",
          address_line1: "12 Market Road",
          city: "Jaipur",
          state: "Rajasthan",
          pincode: "302001",
          businessAddress: {
            addressLine1: "12 Market Road",
            city: "Jaipur",
            state: "Rajasthan",
            pincode: "302001",
          },
          phone: "+91-9876543210",
          email: "billing@sunrisetraders.in",
          website: "https://sunrisetraders.in",
          logo_url: null,
          tax_id: "08ABCDE1234F1Z5",
          currency: "INR",
          show_logo_on_invoice: true,
          show_tax_number: true,
          show_payment_qr: false,
          created_at: "2025-12-15T09:00:00.000Z",
          updated_at: nowIso,
        },
        subscription: {
          planId: "pro",
          planName: "Pro",
          status: "ACTIVE",
          billingCycle: "monthly",
          startedAt: "2026-01-02T08:00:00.000Z",
          trialEndsAt: null,
          currentPeriodStart: "2026-04-01T00:00:00.000Z",
          currentPeriodEnd: "2026-04-30T23:59:59.000Z",
          cancelledAt: null,
          expiresAt: null,
          usage: {
            periodKey: "2026-04",
            periodStart: "2026-04-01T00:00:00.000Z",
            periodEnd: "2026-04-30T23:59:59.000Z",
            invoicesCreated: 214,
            productsCreated: 42,
            customersCreated: 86,
          },
          limits: {
            invoicesPerMonth: 500,
          },
        },
        permissions: {
          plan: "pro",
          isSubscribed: true,
          features: {
            maxInvoices: 500,
            analytics: true,
            teamAccess: true,
            export: true,
          },
          usage: {
            invoicesUsed: 214,
          },
          limitsReached: {
            invoicesLimitReached: false,
          },
        },
        invoices: [
          {
            id: 3001,
            invoice_number: "INV-3001",
            date: "2026-04-10",
            due_date: "2026-04-16",
            status: "SENT",
            subtotal: "24000",
            tax: "1200",
            discount: "0",
            total: "25200",
            notes: null,
            customer: null,
            payments: [{ id: 8001, amount: "12000", method: "UPI" }],
            items: [],
          },
          {
            id: 3002,
            invoice_number: "INV-3002",
            date: "2026-04-06",
            due_date: "2026-04-11",
            status: "OVERDUE",
            subtotal: "31000",
            tax: "1550",
            discount: "500",
            total: "32050",
            notes: null,
            customer: null,
            payments: [{ id: 8002, amount: "8000", method: "CASH" }],
            items: [],
          },
          {
            id: 3003,
            invoice_number: "INV-3003",
            date: "2026-04-03",
            due_date: "2026-04-18",
            status: "PARTIALLY_PAID",
            subtotal: "18800",
            tax: "940",
            discount: "0",
            total: "19740",
            notes: null,
            customer: null,
            payments: [{ id: 8003, amount: "10000", method: "BANK_TRANSFER" }],
            items: [],
          },
        ],
        customers: [
          {
            id: 11,
            name: "Ritu Stores",
            phone: "+91-9012345678",
            address: "Jaipur",
          },
          {
            id: 12,
            name: "Om Retail",
            phone: "+91-9988776655",
            address: "Ajmer",
          },
        ],
        productCount: 148,
        securityActivity: [
          {
            id: 1,
            method: "PASSWORD",
            success: true,
            ipAddress: "127.0.0.1",
            userAgent: "Playwright",
            createdAt: "2026-04-13T10:12:00.000Z",
          },
          {
            id: 2,
            method: "GOOGLE_OAUTH",
            success: true,
            ipAddress: "127.0.0.1",
            userAgent: "Playwright",
            createdAt: "2026-04-12T08:40:00.000Z",
          },
          {
            id: 3,
            method: "PASSWORD",
            success: false,
            ipAddress: "127.0.0.1",
            userAgent: "Playwright",
            createdAt: "2026-04-10T07:25:00.000Z",
          },
        ],
      }}
    />
  );
};

export default ProfileHubPreviewPage;
