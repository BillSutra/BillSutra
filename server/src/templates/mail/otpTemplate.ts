import { renderEmailLayout } from "./layout.js";
import { renderTemplate } from "./renderTemplate.js";

export type OtpTemplateData = {
  otp: string;
  expiresInMinutes: number;
  brandName?: string;
};

const otpBodyTemplate = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
  <tr>
    <td align="center" style="padding-bottom:8px;font-size:14px;line-height:22px;color:#6b7280;">One-time password</td>
  </tr>
  <tr>
    <td align="center" style="padding-bottom:16px;font-size:28px;line-height:36px;font-weight:700;color:#111827;">Use this OTP to continue</td>
  </tr>
  <tr>
    <td align="center" style="padding-bottom:20px;">
      <div style="display:inline-block;padding:18px 28px;border:1px solid #d1d5db;border-radius:14px;background-color:#f9fafb;font-size:36px;line-height:42px;font-weight:700;letter-spacing:8px;color:#111827;">
        {{otp}}
      </div>
    </td>
  </tr>
  <tr>
    <td align="center" style="font-size:14px;line-height:22px;color:#4b5563;">
      This OTP will expire in {{expiresInMinutes}} minute(s).
    </td>
  </tr>
  <tr>
    <td align="center" style="padding-top:12px;font-size:12px;line-height:18px;color:#6b7280;">
      If you did not request this code, you can safely ignore this email.
    </td>
  </tr>
</table>
`;

export const buildOtpEmailTemplate = (data: OtpTemplateData) => {
  const brandName = data.brandName ?? "BillSutra";
  const html = renderEmailLayout({
    title: `${brandName} OTP`,
    preheader: `Your ${brandName} OTP is ${data.otp}`,
    bodyHtml: renderTemplate(otpBodyTemplate, data),
  });

  return {
    subject: `${brandName} verification code`,
    html,
    text: `Your ${brandName} OTP is ${data.otp}. It expires in ${data.expiresInMinutes} minute(s).`,
  };
};
