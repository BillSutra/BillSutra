import { renderEmailLayout } from "./layout.js";
import { renderTemplate } from "./renderTemplate.js";

export type InvoiceEmailItem = {
  name: string;
  qty: number;
  price: number;
};

export type InvoiceTemplateData = {
  businessName: string;
  businessLogoUrl?: string | null;
  customerName: string;
  invoiceId: string;
  items: InvoiceEmailItem[];
  gst: number;
  discount: number;
  total: number;
  downloadLink: string;
  currency?: string;
};

const invoiceBodyTemplate = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
  <tr>
    <td style="padding-bottom:24px;border-bottom:1px solid #e5e7eb;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
        <tr>
          <td valign="top">
            {{#if businessLogoUrl}}
              <img src="{{businessLogoUrl}}" alt="{{businessName}}" style="display:block;max-height:48px;max-width:160px;border:0;outline:none;text-decoration:none;margin-bottom:12px;" />
            {{/if}}
            <p style="margin:0;font-size:24px;line-height:32px;font-weight:700;color:#111827;">{{businessName}}</p>
            <p style="margin:12px 0 0;font-size:14px;line-height:22px;color:#4b5563;">Invoice ID: <strong>{{invoiceId}}</strong></p>
            <p style="margin:6px 0 0;font-size:14px;line-height:22px;color:#4b5563;">Customer: <strong>{{customerName}}</strong></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <tr>
          <td style="padding:0 0 12px;font-size:16px;line-height:24px;font-weight:700;color:#111827;">Invoice summary</td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;table-layout:fixed;border:1px solid #e5e7eb;">
        <tr>
          <th align="left" style="padding:12px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;background-color:#f9fafb;font-size:13px;line-height:18px;color:#374151;">Item</th>
          <th align="left" style="padding:12px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;background-color:#f9fafb;font-size:13px;line-height:18px;color:#374151;width:80px;">Qty</th>
          <th align="right" style="padding:12px;border-bottom:1px solid #e5e7eb;background-color:#f9fafb;font-size:13px;line-height:18px;color:#374151;width:140px;">Price</th>
        </tr>
        {{#each items}}
          <tr>
            <td style="padding:12px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;font-size:14px;line-height:20px;color:#111827;">{{name}}</td>
            <td style="padding:12px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;font-size:14px;line-height:20px;color:#111827;">{{qty}}</td>
            <td align="right" style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;line-height:20px;color:#111827;">{{formatCurrency price ../currency}}</td>
          </tr>
        {{/each}}
        <tr>
          <td colspan="2" align="right" style="padding:12px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;font-size:13px;line-height:18px;color:#4b5563;">GST</td>
          <td align="right" style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;line-height:18px;color:#111827;">{{formatCurrency gst currency}}</td>
        </tr>
        <tr>
          <td colspan="2" align="right" style="padding:12px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;font-size:13px;line-height:18px;color:#4b5563;">Discount</td>
          <td align="right" style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;line-height:18px;color:#111827;">{{formatCurrency discount currency}}</td>
        </tr>
        <tr>
          <td colspan="2" align="right" style="padding:14px 12px;border-right:1px solid #e5e7eb;background-color:#f9fafb;font-size:15px;line-height:20px;font-weight:700;color:#111827;">Total</td>
          <td align="right" style="padding:14px 12px;background-color:#f9fafb;font-size:16px;line-height:22px;font-weight:700;color:#111827;">{{formatCurrency total currency}}</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" bgcolor="#111827" style="border-radius:8px;">
            <a href="{{downloadLink}}" style="display:inline-block;padding:14px 24px;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Download Invoice</a>
          </td>
        </tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;line-height:18px;color:#6b7280;">If the button does not work, copy and paste this link into your browser: {{downloadLink}}</p>
    </td>
  </tr>
</table>
`;

export const buildInvoiceEmailTemplate = (data: InvoiceTemplateData) => {
  const currency = data.currency ?? "INR";
  const html = renderEmailLayout({
    title: `Invoice ${data.invoiceId}`,
    preheader: `Invoice ${data.invoiceId} from ${data.businessName}`,
    bodyHtml: renderTemplate(invoiceBodyTemplate, {
      ...data,
      currency,
    }),
  });

  return {
    subject: `Invoice ${data.invoiceId} from ${data.businessName}`,
    html,
    text: `Hello ${data.customerName}, your invoice ${data.invoiceId} is ready. Total: ${new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(data.total)}. Download: ${data.downloadLink}`,
  };
};
