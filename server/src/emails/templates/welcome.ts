import type { EmailMessage, WelcomeEmailData } from "../types.js";
import { createEmailLayout, escapeHtml } from "./shared.js";

export const buildWelcomeEmail = ({
  email,
  user_name,
  login_url,
}: WelcomeEmailData): EmailMessage => {
  const safeName = user_name.trim() || "there";

  return {
    to: email,
    subject: "Welcome to BillSutra",
    text: `Welcome to BillSutra, ${safeName}. Sign in here: ${login_url}`,
    html: createEmailLayout({
      previewText: `Welcome to BillSutra, ${safeName}.`,
      title: "Welcome aboard",
      intro: "Your BillSutra account is ready.",
      cta: {
        label: "Sign in to BillSutra",
        url: login_url,
      },
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(safeName)},</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Your workspace is set up and ready for invoices, payments, exports, and day-to-day billing operations.</p>`,
        `<p style="margin:0;font-size:15px;line-height:1.7;">Use the button below to sign in and continue.</p>`,
      ],
      footer: "Welcome to BillSutra.",
    }),
  };
};
