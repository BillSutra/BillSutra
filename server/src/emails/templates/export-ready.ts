import type { EmailMessage, ExportReadyEmailData } from "../types.js";
import { createEmailLayout, escapeHtml } from "./shared.js";

export const buildExportReadyEmail = ({
  email,
  user_name,
  resource,
  format,
  exported_count,
  file_name,
  attachment,
}: ExportReadyEmailData): EmailMessage => {
  const safeName = user_name.trim() || "there";

  return {
    to: email,
    subject: `Your ${resource} export is ready`,
    attachments: [attachment],
    text: `Hi ${safeName}, your ${resource} export is attached as ${file_name}. Format: ${format.toUpperCase()}. Records exported: ${exported_count}.`,
    html: createEmailLayout({
      previewText: `Your ${resource} export is ready.`,
      title: "Export ready",
      intro: `Your requested ${resource} export has been attached to this email.`,
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(safeName)},</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">The export file is attached and ready to download.</p>`,
        `<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.8;">
          <li>Resource: ${escapeHtml(resource)}</li>
          <li>Format: ${escapeHtml(format.toUpperCase())}</li>
          <li>Exported records: ${exported_count}</li>
          <li>File name: ${escapeHtml(file_name)}</li>
        </ul>`,
      ],
      footer: "Exports generated from BillSutra are attached directly to this email.",
    }),
  };
};
