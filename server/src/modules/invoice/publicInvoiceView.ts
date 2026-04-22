import type { PublicInvoiceViewData } from "./invoice.service.js";

const escapeHtml = (text: unknown) =>
  String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string | null) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const renderMultiline = (value: string | null | undefined) =>
  String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join("<br />");

const renderDiscountLabel = (invoice: PublicInvoiceViewData) => {
  if (invoice.discount_type === "PERCENTAGE") {
    return `Discount (${invoice.discount_value.toFixed(2)}%)`;
  }

  return `Discount (${formatCurrency(invoice.discount_value, invoice.currency)})`;
};

export const renderPublicInvoiceHtml = (invoice: PublicInvoiceViewData) => {
  const itemRows = invoice.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${item.quantity}</td>
          <td>${escapeHtml(formatCurrency(item.unit_price, invoice.currency))}</td>
          <td>${item.tax_rate === null ? "-" : `${item.tax_rate}%`}</td>
          <td>${escapeHtml(formatCurrency(item.line_total, invoice.currency))}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="noindex,nofollow" />
        <title>Invoice ${escapeHtml(invoice.invoice_id)}</title>
        <style>
          :root {
            color-scheme: light;
            --bg: #f8fafc;
            --panel: rgba(255, 255, 255, 0.96);
            --ink: #0f172a;
            --muted: #64748b;
            --line: #e2e8f0;
            --soft: #eef4ff;
            --accent: #0f766e;
            --accent-soft: #ccfbf1;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Inter, "Segoe UI", Arial, sans-serif;
            background:
              radial-gradient(circle at top, rgba(125, 211, 252, 0.28), transparent 38%),
              linear-gradient(180deg, #f8fafc 0%, #eef4ff 52%, #ffffff 100%);
            color: var(--ink);
          }
          .shell {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px 16px;
          }
          .card {
            width: min(100%, 1100px);
            background: var(--panel);
            border: 1px solid rgba(255, 255, 255, 0.8);
            border-radius: 28px;
            box-shadow: 0 32px 96px -52px rgba(15, 23, 42, 0.45);
            overflow: hidden;
          }
          .hero {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding: 32px;
            border-bottom: 1px solid var(--line);
          }
          .hero h1 {
            margin: 10px 0 0;
            font-size: clamp(2rem, 4vw, 3rem);
            line-height: 1.05;
          }
          .eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 8px 14px;
            border-radius: 999px;
            background: var(--soft);
            color: #0369a1;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }
          .summary {
            min-width: 280px;
            border: 1px solid var(--line);
            border-radius: 22px;
            background: #fff;
            padding: 20px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-top: 18px;
          }
          .summary-grid div,
          .detail-card,
          .totals-card {
            border: 1px solid var(--line);
            border-radius: 18px;
            background: #fff;
          }
          .summary-grid div {
            padding: 14px;
          }
          .label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: var(--muted);
            font-weight: 700;
          }
          .value {
            margin-top: 8px;
            font-size: 16px;
            font-weight: 600;
          }
          .body {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 320px;
            gap: 24px;
            padding: 32px;
          }
          .detail-card, .totals-card {
            padding: 20px;
          }
          .detail-card h2,
          .totals-card h2 {
            margin: 0 0 16px;
            font-size: 18px;
          }
          .detail-list {
            display: grid;
            gap: 12px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 24px;
            border: 1px solid var(--line);
            border-radius: 20px;
            overflow: hidden;
            background: #fff;
          }
          th, td {
            padding: 14px 16px;
            border-bottom: 1px solid var(--line);
            text-align: left;
            font-size: 14px;
          }
          th {
            background: #f8fafc;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-size: 12px;
          }
          td:last-child,
          th:last-child,
          td:nth-last-child(2),
          th:nth-last-child(2),
          td:nth-last-child(3),
          th:nth-last-child(3) {
            text-align: right;
          }
          .notes {
            margin-top: 24px;
            border: 1px solid var(--line);
            border-radius: 20px;
            background: #fff;
            padding: 18px;
            font-size: 14px;
            line-height: 1.7;
          }
          .totals-grid {
            display: grid;
            gap: 12px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 14px 16px;
            border: 1px solid var(--line);
            border-radius: 16px;
            background: #fff;
            font-size: 14px;
          }
          .totals-row.total {
            background: var(--accent-soft);
            border-color: rgba(15, 118, 110, 0.18);
            color: #134e4a;
            font-weight: 700;
          }
          .footer {
            padding: 0 32px 32px;
            color: var(--muted);
            font-size: 13px;
          }
          @media (max-width: 900px) {
            .hero,
            .body {
              grid-template-columns: 1fr;
              display: grid;
            }
            .summary {
              min-width: 0;
            }
          }
          @media (max-width: 640px) {
            .hero,
            .body,
            .footer {
              padding: 20px;
            }
            .summary-grid {
              grid-template-columns: 1fr;
            }
            th:nth-child(1),
            td:nth-child(1) {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <article class="card">
            <section class="hero">
              <div>
                <div class="eyebrow">Billsutra Public Invoice</div>
                <h1>Invoice ${escapeHtml(invoice.invoice_id)}</h1>
                <p style="margin:16px 0 0;color:var(--muted);max-width:56ch;line-height:1.7;">
                  Shared by ${escapeHtml(invoice.business_name)} for ${escapeHtml(invoice.customer_name)}.
                  Review the bill details, issued amount, and due date below.
                </p>
                <div class="summary-grid">
                  <div>
                    <div class="label">Issue date</div>
                    <div class="value">${escapeHtml(formatDate(invoice.date))}</div>
                  </div>
                  <div>
                    <div class="label">Due date</div>
                    <div class="value">${escapeHtml(formatDate(invoice.due_date))}</div>
                  </div>
                  <div>
                    <div class="label">Status</div>
                    <div class="value">${escapeHtml(invoice.status)}</div>
                  </div>
                  <div>
                    <div class="label">Amount</div>
                    <div class="value">${escapeHtml(formatCurrency(invoice.amount, invoice.currency))}</div>
                  </div>
                </div>
              </div>

              <aside class="summary">
                <div class="label">Billing from</div>
                <div class="value">${escapeHtml(invoice.business_name)}</div>
                <div style="margin-top:12px;color:var(--muted);font-size:14px;line-height:1.7;">
                  ${escapeHtml(invoice.business_email ?? "")}<br />
                  ${escapeHtml(invoice.business_phone ?? "")}<br />
                  ${renderMultiline(invoice.business_address)}
                </div>
              </aside>
            </section>

            <section class="body">
              <div>
                <div class="detail-card">
                  <h2>Customer details</h2>
                  <div class="detail-list">
                    <div class="detail-row"><span class="label">Name</span><strong>${escapeHtml(invoice.customer_display_name || invoice.customer_name)}</strong></div>
                    ${invoice.customer_type === "business" ? `<div class="detail-row"><span class="label">Type</span><span>Business</span></div>` : ""}
                    ${invoice.customer_type === "business" && invoice.customer_gstin ? `<div class="detail-row"><span class="label">GSTIN</span><span>${escapeHtml(invoice.customer_gstin)}</span></div>` : ""}
                    <div class="detail-row"><span class="label">Email</span><span>${escapeHtml(invoice.email ?? "-")}</span></div>
                    <div class="detail-row"><span class="label">Phone</span><span>${escapeHtml(invoice.customer_phone ?? "-")}</span></div>
                    <div class="detail-row"><span class="label">Address</span><span>${invoice.customer_address ? renderMultiline(invoice.customer_address) : "-"}</span></div>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Tax</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemRows}
                  </tbody>
                </table>

                ${invoice.notes ? `<div class="notes"><strong>Notes</strong><div style="margin-top:10px;">${escapeHtml(invoice.notes)}</div></div>` : ""}
              </div>

              <aside class="totals-card">
                <h2>Invoice summary</h2>
                <div class="totals-grid">
                  <div class="totals-row"><span>Subtotal</span><strong>${escapeHtml(formatCurrency(invoice.subtotal, invoice.currency))}</strong></div>
                  <div class="totals-row"><span>Tax</span><strong>${escapeHtml(formatCurrency(invoice.tax, invoice.currency))}</strong></div>
                  <div class="totals-row"><span>${escapeHtml(renderDiscountLabel(invoice))}</span><strong>-${escapeHtml(formatCurrency(invoice.discount, invoice.currency))}</strong></div>
                  <div class="totals-row total"><span>Grand total</span><strong>${escapeHtml(formatCurrency(invoice.amount, invoice.currency))}</strong></div>
                </div>
              </aside>
            </section>

            <footer class="footer">
              Public invoice link: ${escapeHtml(invoice.public_url)}
            </footer>
          </article>
        </div>
      </body>
    </html>
  `;
};
