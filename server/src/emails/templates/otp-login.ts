import type { EmailMessage, OtpLoginEmailData } from "../types.js";
import { createEmailLayout, escapeHtml } from "./shared.js";

export const buildOtpLoginEmail = ({
  email,
  user_name,
  code,
  expires_in_minutes,
  resend_in_seconds,
}: OtpLoginEmailData): EmailMessage => {
  const safeName = user_name.trim() || "there";

  return {
    to: email,
    subject: "Your BillSutra login code",
    text: `Hi ${safeName}, your BillSutra login code is ${code}. It expires in ${expires_in_minutes} minute(s). You can request a new code after ${resend_in_seconds} second(s).`,
    html: createEmailLayout({
      previewText: `Your BillSutra login code is ${code}.`,
      title: "Your login code",
      intro: "Use this one-time code to sign in.",
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(safeName)},</p>`,
        `<div style="margin:20px 0;border:1px solid #bfdbfe;border-radius:18px;background:#eff6ff;padding:18px 20px;text-align:center;font-size:30px;font-weight:700;letter-spacing:0.28em;color:#1d4ed8;">${escapeHtml(code)}</div>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">This code expires in ${expires_in_minutes} minute(s) and can only be used once.</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">You can request a new code after ${resend_in_seconds} second(s).</p>`,
        `<p style="margin:0;font-size:15px;line-height:1.7;">If you did not request this sign-in code, you can ignore this email.</p>`,
      ],
      footer: "Never share your login code with anyone.",
    }),
  };
};
