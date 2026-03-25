import type {
  DeleteAccountConfirmationEmailData,
  EmailMessage,
} from "../types.js";
import { createEmailLayout, escapeHtml } from "./shared.js";

export const buildDeleteAccountConfirmationEmail = ({
  email,
  user_name,
}: DeleteAccountConfirmationEmailData): EmailMessage => {
  const safeName = user_name.trim() || "there";

  return {
    to: email,
    subject: "Your BillSutra account was deleted",
    text: `Hi ${safeName}, your BillSutra account has been deleted.`,
    html: createEmailLayout({
      previewText: "Your BillSutra account was deleted.",
      title: "Account deletion complete",
      intro: "Your BillSutra account and linked data have been removed.",
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(safeName)},</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">This email confirms that your BillSutra account has been permanently deleted.</p>`,
        `<p style="margin:0;font-size:15px;line-height:1.7;">If you did not perform this action, contact support immediately.</p>`,
      ],
      footer: "This message confirms a completed account deletion request.",
    }),
  };
};
