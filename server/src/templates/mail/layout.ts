import { renderTemplate, toSafeHtml } from "./renderTemplate.js";

type EmailLayoutInput = {
  title: string;
  preheader: string;
  bodyHtml: string;
  footerText?: string;
};

const layoutTemplate = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{title}}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      {{preheader}}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f6fb;margin:0;padding:24px 0;width:100%;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;width:100%;">
            <tr>
              <td style="padding:0 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:16px;width:100%;">
                  <tr>
                    <td style="padding:32px 28px;">
                      {{{bodyHtml}}}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 0;text-align:center;color:#6b7280;font-size:12px;line-height:18px;">
                {{footerText}}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

export const renderEmailLayout = ({
  title,
  preheader,
  bodyHtml,
  footerText = "This email was sent by BillSutra.",
}: EmailLayoutInput) => {
  return renderTemplate(layoutTemplate, {
    title,
    preheader,
    bodyHtml: toSafeHtml(bodyHtml),
    footerText,
  });
};
