import type { EmailMessage, VerifyEmailOtpData } from "../types.js";
import { createEmailLayout, escapeHtml } from "./shared.js";

export const buildVerifyEmailOtpEmail = ({
  email,
  user_name,
  code,
  expires_in_minutes,
}: VerifyEmailOtpData): EmailMessage => {
  const safeName = user_name.trim() || "there";

  return {
    to: email,
    subject: "Verify your BillSutra account",
    text: `Welcome to BillSutra! Your verification code is ${code}. This code expires in ${expires_in_minutes} minutes. If you did not create this account, ignore this email.`,
    html: createEmailLayout({
      previewText: `Your BillSutra verification code is ${code}.`,
      title: "Verify your account",
      intro: "Complete your email verification to unlock your BillSutra workspace.",
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Welcome to BillSutra, ${escapeHtml(safeName)}!</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Use the verification code below to activate your account.</p>`,
        `<div style="margin:20px 0;border:1px solid #bfdbfe;border-radius:18px;background:#eff6ff;padding:18px 20px;text-align:center;font-size:30px;font-weight:700;letter-spacing:0.28em;color:#1d4ed8;">${escapeHtml(code)}</div>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">This code expires in ${expires_in_minutes} minutes.</p>`,
        `<p style="margin:0;font-size:15px;line-height:1.7;">If you did not create this account, you can safely ignore this email.</p>`,
      ],
      footer: "Never share your verification code with anyone.",
    }),
  };
};
