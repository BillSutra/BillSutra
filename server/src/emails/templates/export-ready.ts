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
  download_url,
}: ExportReadyEmailData): EmailMessage => {
  const safeName = user_name.trim() || "there";
  const hasAttachment = Boolean(attachment);
  const hasDownloadUrl = Boolean(download_url?.trim());
  const deliveryDescription = hasAttachment
    ? "attached to this email"
    : hasDownloadUrl
      ? "available from your secure download link"
      : "ready";

  return {
    to: email,
    subject: `Your ${resource} export is ready`,
    ...(hasAttachment ? { attachments: [attachment as NonNullable<typeof attachment>] } : {}),
    text: `Hi ${safeName}, your ${resource} export is ${deliveryDescription} as ${file_name}. Format: ${format.toUpperCase()}. Records exported: ${exported_count}.${hasDownloadUrl ? ` Download it here: ${download_url}` : ""}`,
    html: createEmailLayout({
      previewText: `Your ${resource} export is ready.`,
      title: "Export ready",
      intro: hasAttachment
        ? `Your requested ${resource} export has been attached to this email.`
        : `Your requested ${resource} export is ready to download securely.`,
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(safeName)},</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">${
          hasAttachment
            ? "The export file is attached and ready to download."
            : "Use the secure download button below to access your export."
        }</p>`,
        `<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.8;">
          <li>Resource: ${escapeHtml(resource)}</li>
          <li>Format: ${escapeHtml(format.toUpperCase())}</li>
          <li>Exported records: ${exported_count}</li>
          <li>File name: ${escapeHtml(file_name)}</li>
        </ul>`,
      ],
      ...(hasDownloadUrl
        ? {
            cta: {
              label: "Download export",
              url: download_url as string,
            },
          }
        : {}),
      footer: hasAttachment
        ? "Exports generated from BillSutra are attached directly to this email."
        : "Exports generated from BillSutra are available from a secure download link.",
    }),
  };
};
