import type { EmailMessage, PasswordResetEmailData } from "../types.js";
import { createEmailLayout, escapeHtml } from "./shared.js";

export const buildPasswordResetEmail = ({
  email,
  user_name,
  reset_url,
}: PasswordResetEmailData): EmailMessage => {
  const safeName = user_name.trim() || "there";

  return {
    to: email,
    subject: "Reset your BillSutra password",
    text: `Hi ${safeName}, reset your BillSutra password here: ${reset_url}`,
    html: createEmailLayout({
      previewText: "Reset your BillSutra password.",
      title: "Password reset requested",
      intro: "Use the secure link below to choose a new password.",
      cta: {
        label: "Reset password",
        url: reset_url,
      },
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(safeName)},</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">We received a request to reset your BillSutra password. This link is intended only for you.</p>`,
        `<p style="margin:0;font-size:15px;line-height:1.7;">If you did not request this, you can ignore this email.</p>`,
      ],
      footer: "For your security, use the reset link only if you requested it.",
    }),
  };
};
