import type { EmailMessage, PaymentAccessApprovedEmailData } from "../types.js";
import {
  createEmailLayout,
  createSummaryTable,
  escapeHtml,
  formatCurrency,
} from "./shared.js";

export const buildPaymentAccessApprovedEmail = (
  payload: PaymentAccessApprovedEmailData,
): EmailMessage => {
  const subject = `Your ${payload.plan_name} access is approved`;
  const intro = `Hi ${payload.user_name}, your manual payment was approved and your paid access is now active.`;
  const summary = createSummaryTable([
    { label: "Plan", value: payload.plan_name },
    { label: "Amount", value: formatCurrency(payload.amount, "INR") },
    { label: "Status", value: "Approved" },
  ]);

  const html = createEmailLayout({
    previewText: subject,
    title: "Payment approved",
    intro,
    sections: [
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
        Your payment has been reviewed successfully. You can now continue with your paid workspace features.
      </p>`,
      summary,
      `<p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#475569;">
        If this was not expected, reply to this email and our team will help you out.
      </p>`,
    ],
    cta: {
      label: "Open payment status",
      url: payload.status_page_url,
    },
    footer: "BillSutra payment review notification.",
  });

  const text = [
    subject,
    "",
    intro,
    `Plan: ${payload.plan_name}`,
    `Amount: ${formatCurrency(payload.amount, "INR")}`,
    `Status page: ${payload.status_page_url}`,
    "",
    `Thanks, ${escapeHtml("BillSutra")}`,
  ].join("\n");

  return {
    to: payload.email,
    subject,
    html,
    text,
  };
};
