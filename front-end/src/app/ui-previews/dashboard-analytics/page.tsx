import { notFound } from "next/navigation";
import DashboardSalesAnalyticsPanel from "@/components/dashboard/dashboard-sales-analytics-panel";
import type { DashboardSales } from "@/lib/apiClient";

const sampleSalesData: DashboardSales = {
  last7Days: [
    { date: "2026-04-07", sales: 42000, purchases: 18000 },
    { date: "2026-04-08", sales: 39000, purchases: 22000 },
    { date: "2026-04-09", sales: 46000, purchases: 21000 },
    { date: "2026-04-10", sales: 52000, purchases: 26000 },
    { date: "2026-04-11", sales: 51000, purchases: 24000 },
    { date: "2026-04-12", sales: 58000, purchases: 28000 },
    { date: "2026-04-13", sales: 61000, purchases: 30000 },
  ],
  last30Days: Array.from({ length: 30 }).map((_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      date: `2026-03-${day}`,
      sales: 32000 + index * 900 + (index % 3) * 1800,
      purchases: 18000 + index * 600 + (index % 4) * 1400,
    };
  }),
  monthly: [
    { month: "Nov", sales: 732000, purchases: 492000 },
    { month: "Dec", sales: 758000, purchases: 506000 },
    { month: "Jan", sales: 811000, purchases: 538000 },
    { month: "Feb", sales: 845000, purchases: 563000 },
    { month: "Mar", sales: 882000, purchases: 590000 },
    { month: "Apr", sales: 921000, purchases: 612000 },
  ],
  categories: [
    { name: "Groceries", value: 480000 },
    { name: "Household", value: 230000 },
    { name: "Personal Care", value: 170000 },
  ],
};

const DashboardAnalyticsPreviewPage = () => {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f3ee] px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-[1300px]">
        <DashboardSalesAnalyticsPanel
          previewData={sampleSalesData}
          lowStockCount={9}
          overdueInvoiceCount={6}
          pendingCustomerDue={248000}
          pendingSupplierDue={121000}
          supplierPayablesCount={4}
        />
      </div>
    </main>
  );
};

export default DashboardAnalyticsPreviewPage;
