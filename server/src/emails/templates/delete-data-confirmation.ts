import type {
  DeleteDataConfirmationEmailData,
  EmailMessage,
} from "../types.js";
import { createEmailLayout, escapeHtml } from "./shared.js";

export const buildDeleteDataConfirmationEmail = ({
  email,
  user_name,
}: DeleteDataConfirmationEmailData): EmailMessage => {
  const safeName = user_name.trim() || "there";

  return {
    to: email,
    subject: "Your BillSutra data was deleted",
    text: `Hi ${safeName}, your BillSutra business data has been deleted.`,
    html: createEmailLayout({
      previewText: "Your BillSutra data was deleted.",
      title: "Data deletion complete",
      intro: "Your request to delete stored business data has been completed.",
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(safeName)},</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">We removed the business data linked to your BillSutra account. Your account itself is still active.</p>`,
        `<p style="margin:0;font-size:15px;line-height:1.7;">If this was not expected, contact support immediately.</p>`,
      ],
      footer: "This message confirms a completed data deletion request.",
    }),
  };
};
