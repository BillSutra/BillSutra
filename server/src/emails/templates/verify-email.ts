import type { EmailMessage, VerifyEmailData } from "../types.js";
import { createEmailLayout, escapeHtml } from "./shared.js";

export const buildVerifyEmailEmail = ({
  email,
  user_name,
  verify_url,
  expires_in_minutes,
}: VerifyEmailData): EmailMessage => {
  const safeName = user_name.trim() || "there";

  return {
    to: email,
    subject: "Verify your BillSutra email",
    text: `Hi ${safeName}, verify your email for BillSutra here: ${verify_url} This link expires in ${expires_in_minutes} minutes.`,
    html: createEmailLayout({
      previewText: "Verify your email to unlock your BillSutra workspace.",
      title: "Verify your email",
      intro: "Confirm your email address to unlock full access to your workspace.",
      cta: {
        label: "Verify email",
        url: verify_url,
      },
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(safeName)},</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Thanks for creating your BillSutra account. Please verify this email address to continue with invoices, reports, exports, and the rest of your workspace.</p>`,
        `<p style="margin:0;font-size:15px;line-height:1.7;">This verification link expires in ${expires_in_minutes} minutes.</p>`,
      ],
      footer: "If you did not create this account, you can safely ignore this email.",
    }),
  };
};
