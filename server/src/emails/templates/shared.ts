type EmailLayoutInput = {
  previewText: string;
  title: string;
  intro: string;
  sections: string[];
  brandName?: string;
  brandLogoUrl?: string | null;
  cta?: {
    label: string;
    url: string;
  };
  footer?: string;
};

export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const formatDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatCurrency = (value: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);

export const createSummaryTable = (
  rows: Array<{ label: string; value: string }>,
) =>
  `
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tbody>
        ${rows
          .map(
            ({ label, value }) => `
              <tr>
                <td style="padding:10px 12px;border:1px solid #e5e7eb;background:#fafaf9;font-weight:600;width:35%;">
                  ${escapeHtml(label)}
                </td>
                <td style="padding:10px 12px;border:1px solid #e5e7eb;">
                  ${escapeHtml(value)}
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;

export const createEmailLayout = ({
  previewText,
  title,
  intro,
  sections,
  brandName = "BillSutra",
  brandLogoUrl,
  cta,
  footer,
}: EmailLayoutInput) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f5f5f4;padding:24px;font-family:Arial,sans-serif;color:#1c1917;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(previewText)}
    </div>
    <div style="margin:0 auto;max-width:680px;overflow:hidden;border:1px solid #e7e5e4;border-radius:20px;background:#ffffff;">
      <div style="background:linear-gradient(135deg,#0f172a,#1d4ed8);padding:28px 32px;color:#ffffff;">
        <div style="display:flex;align-items:center;gap:12px;margin:0 0 12px;">
          ${
            brandLogoUrl
              ? `
                <div style="display:flex;height:42px;width:42px;align-items:center;justify-content:center;border-radius:12px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);overflow:hidden;">
                  <img src="${escapeHtml(brandLogoUrl)}" alt="${escapeHtml(brandName)} logo" style="max-width:100%;max-height:100%;display:block;" />
                </div>
              `
              : ""
          }
          <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;">
            ${escapeHtml(brandName)}
          </p>
        </div>
        <h1 style="margin:0;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h1>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;opacity:0.92;">
          ${escapeHtml(intro)}
        </p>
      </div>
      <div style="padding:32px;">
        ${sections.join("")}
        ${
          cta
            ? `
              <div style="margin:28px 0 8px;">
                <a
                  href="${escapeHtml(cta.url)}"
                  style="display:inline-block;border-radius:999px;background:#1d4ed8;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:700;"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ${escapeHtml(cta.label)}
                </a>
              </div>
            `
            : ""
        }
      </div>
      <div style="border-top:1px solid #e7e5e4;background:#fafaf9;padding:18px 32px;font-size:13px;line-height:1.6;color:#57534e;">
        ${escapeHtml(footer ?? "This email was sent by BillSutra.")}
      </div>
    </div>
  </body>
</html>`;
