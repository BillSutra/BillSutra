import type { EmailMessage, LowStockAlertEmailData } from "../types.js";
import { createEmailLayout, escapeHtml } from "./shared.js";

const severityTone = (severity: "critical" | "warning" | "info") => {
  if (severity === "critical") {
    return {
      bg: "#fef2f2",
      border: "#fecaca",
      text: "#b91c1c",
      label: "Critical",
    };
  }

  if (severity === "warning") {
    return {
      bg: "#fff7ed",
      border: "#fed7aa",
      text: "#c2410c",
      label: "Warning",
    };
  }

  return {
    bg: "#eff6ff",
    border: "#bfdbfe",
    text: "#1d4ed8",
    label: "Info",
  };
};

export const buildLowStockAlertEmail = ({
  email,
  user_name,
  business_name,
  business_logo_url,
  inventory_url,
  insights,
}: LowStockAlertEmailData): EmailMessage => ({
  to: email,
  subject: `${business_name}: low stock alert`,
  text: `Hi ${user_name}, ${insights.length} inventory item(s) need attention in BillSutra. Review them here: ${inventory_url}`,
  html: createEmailLayout({
    previewText: `${insights.length} stock alert(s) need attention.`,
    title: "Low stock alert",
    intro: `${business_name} has products that may need restocking soon.`,
    brandName: business_name,
    brandLogoUrl: business_logo_url,
    cta: {
      label: "Open inventory",
      url: inventory_url,
    },
    sections: [
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(user_name)},</p>`,
      `<div style="display:grid;gap:12px;">${insights
        .map((item) => {
          const tone = severityTone(item.severity);
          return `
            <div style="border:1px solid ${tone.border};background:${tone.bg};border-radius:16px;padding:16px 18px;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <div>
                  <div style="font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(item.product_name)}</div>
                  <div style="margin-top:6px;font-size:13px;line-height:1.6;color:#475569;">
                    Stock left: <strong>${item.stock_left}</strong>
                    ${item.threshold != null ? ` | Threshold: <strong>${item.threshold}</strong>` : ""}
                    ${item.warehouse_name ? ` | Warehouse: <strong>${escapeHtml(item.warehouse_name)}</strong>` : ""}
                    ${item.suggested_quantity != null ? ` | Suggested reorder: <strong>${item.suggested_quantity}</strong>` : ""}
                  </div>
                </div>
                <span style="display:inline-flex;border-radius:999px;padding:8px 12px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${tone.text};border:1px solid ${tone.border};background:#ffffff;">
                  ${tone.label}
                </span>
              </div>
            </div>
          `;
        })
        .join("")}</div>`,
    ],
    footer: "You can turn off low stock alert emails anytime from your BillSutra preferences.",
  }),
});
