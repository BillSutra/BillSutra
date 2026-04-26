import type { EmailMessage, WeeklyReportEmailData } from "../types.js";
import {
  createEmailLayout,
  createSummaryTable,
  formatCurrency,
} from "./shared.js";

export const buildWeeklyReportEmail = ({
  email,
  user_name,
  report_week_label,
  invoices_issued,
  total_billed,
  total_collected,
  pending_amount,
  profit,
  overdue_count,
  reports_url,
}: WeeklyReportEmailData): EmailMessage => ({
  to: email,
  subject: `Your BillSutra weekly report: ${report_week_label}`,
  text: `Hi ${user_name}, here is your weekly report for ${report_week_label}. Total billed: ${formatCurrency(total_billed)}. Total collected: ${formatCurrency(total_collected)}. Pending: ${formatCurrency(pending_amount)}. Profit: ${formatCurrency(profit)}.`,
  html: createEmailLayout({
    previewText: `Weekly business summary for ${report_week_label}.`,
    title: "Weekly business report",
    intro: "A quick snapshot of billing, collections, and profitability from the last 7 days.",
    cta: {
      label: "Open reports",
      url: reports_url,
    },
    sections: [
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${user_name},</p>`,
      createSummaryTable([
        { label: "Week", value: report_week_label },
        { label: "Invoices issued", value: String(invoices_issued) },
        { label: "Total billed", value: formatCurrency(total_billed) },
        { label: "Total collected", value: formatCurrency(total_collected) },
        { label: "Pending payments", value: formatCurrency(pending_amount) },
        { label: "Profit", value: formatCurrency(profit) },
        { label: "Overdue invoices", value: String(overdue_count) },
      ]),
    ],
    footer: "You are receiving this weekly summary because business report emails are enabled for your workspace.",
  }),
});
