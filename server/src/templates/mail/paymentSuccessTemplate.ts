import { renderEmailLayout } from "./layout.js";
import { renderTemplate } from "./renderTemplate.js";

export type PaymentSuccessTemplateData = {
  amount: number;
  transactionId: string;
  currency?: string;
  brandName?: string;
};

const paymentBodyTemplate = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
  <tr>
    <td style="padding-bottom:12px;font-size:14px;line-height:22px;color:#16a34a;font-weight:700;">
      Payment received successfully
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:18px;font-size:28px;line-height:36px;font-weight:700;color:#111827;">
      Thank you for your payment
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:14px;background-color:#f9fafb;width:100%;">
        <tr>
          <td style="padding:16px;border-bottom:1px solid #e5e7eb;font-size:13px;line-height:18px;color:#6b7280;">Amount</td>
          <td align="right" style="padding:16px;border-bottom:1px solid #e5e7eb;font-size:18px;line-height:24px;font-weight:700;color:#111827;">{{formatCurrency amount currency}}</td>
        </tr>
        <tr>
          <td style="padding:16px;font-size:13px;line-height:18px;color:#6b7280;">Transaction ID</td>
          <td align="right" style="padding:16px;font-size:14px;line-height:20px;font-weight:600;color:#111827;">{{transactionId}}</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;line-height:20px;color:#6b7280;">
      Keep this email for your records. If you need help, reply to this email and our team will assist you.
    </td>
  </tr>
</table>
`;

export const buildPaymentSuccessTemplate = (
  data: PaymentSuccessTemplateData,
) => {
  const currency = data.currency ?? "INR";
  const brandName = data.brandName ?? "BillSutra";
  const html = renderEmailLayout({
    title: `${brandName} payment confirmation`,
    preheader: `Payment of ${new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(data.amount)} received successfully`,
    bodyHtml: renderTemplate(paymentBodyTemplate, {
      ...data,
      currency,
    }),
  });

  return {
    subject: `${brandName} payment successful`,
    html,
    text: `Payment successful. Amount: ${new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(data.amount)}. Transaction ID: ${data.transactionId}.`,
  };
};
