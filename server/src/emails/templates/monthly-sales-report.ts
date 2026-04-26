import type { EmailMessage, MonthlySalesReportEmailData } from "../types.js";
import {
  createEmailLayout,
  createSummaryTable,
  escapeHtml,
  formatCurrency,
} from "./shared.js";

export const buildMonthlySalesReportEmail = (
  payload: MonthlySalesReportEmailData,
): EmailMessage => {
  const subject = `${payload.report_month_label} sales report`;
  const safeName = payload.user_name.trim() || "there";
  const summary = createSummaryTable([
    { label: "Invoices issued", value: String(payload.invoices_issued) },
    { label: "Total billed", value: formatCurrency(payload.total_billed, "INR") },
    {
      label: "Collections received",
      value: formatCurrency(payload.total_collected, "INR"),
    },
    { label: "Sales entries", value: String(payload.sales_count) },
    { label: "Total sales", value: formatCurrency(payload.total_sales, "INR") },
    { label: "Purchases", value: String(payload.purchases_count) },
    {
      label: "Total purchases",
      value: formatCurrency(payload.total_purchases, "INR"),
    },
    { label: "Profit", value: formatCurrency(payload.profit, "INR") },
    { label: "Overdue invoices", value: String(payload.overdue_count) },
  ]);

  return {
    to: payload.email,
    subject,
    text: [
      `Hi ${safeName},`,
      "",
      `Your BillSutra report for ${payload.report_month_label} is ready.`,
      `Invoices issued: ${payload.invoices_issued}`,
      `Total billed: ${formatCurrency(payload.total_billed, "INR")}`,
      `Collections received: ${formatCurrency(payload.total_collected, "INR")}`,
      `Sales entries: ${payload.sales_count}`,
      `Total sales: ${formatCurrency(payload.total_sales, "INR")}`,
      `Purchases: ${payload.purchases_count}`,
      `Total purchases: ${formatCurrency(payload.total_purchases, "INR")}`,
      `Profit: ${formatCurrency(payload.profit, "INR")}`,
      `Overdue invoices: ${payload.overdue_count}`,
      `Open reports: ${payload.reports_url}`,
    ].join("\n"),
    html: createEmailLayout({
      previewText: `Your ${payload.report_month_label} sales report is ready.`,
      title: "Monthly sales report",
      intro: `Here is your BillSutra summary for ${payload.report_month_label}.`,
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(safeName)},</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">We prepared your monthly performance snapshot so you can review billing, collections, and purchase activity in one place.</p>`,
        summary,
      ],
      cta: {
        label: "Open reports",
        url: payload.reports_url,
      },
      footer: "Monthly business summary from BillSutra.",
    }),
  };
};
