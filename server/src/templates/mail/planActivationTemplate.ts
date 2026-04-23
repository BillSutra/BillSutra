import { renderEmailLayout } from "./layout.js";
import { renderTemplate } from "./renderTemplate.js";

export type PlanActivationTemplateData = {
  planName: string;
  validity: string;
  activationMessage?: string;
  brandName?: string;
};

const planBodyTemplate = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
  <tr>
    <td style="padding-bottom:10px;font-size:14px;line-height:22px;color:#2563eb;font-weight:700;">
      Plan activated
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:18px;font-size:28px;line-height:36px;font-weight:700;color:#111827;">
      Your subscription is now active
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:14px;background-color:#f9fafb;width:100%;">
        <tr>
          <td style="padding:16px;border-bottom:1px solid #e5e7eb;font-size:13px;line-height:18px;color:#6b7280;">Plan</td>
          <td align="right" style="padding:16px;border-bottom:1px solid #e5e7eb;font-size:16px;line-height:22px;font-weight:700;color:#111827;">{{planName}}</td>
        </tr>
        <tr>
          <td style="padding:16px;font-size:13px;line-height:18px;color:#6b7280;">Validity</td>
          <td align="right" style="padding:16px;font-size:14px;line-height:20px;font-weight:600;color:#111827;">{{validity}}</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-size:14px;line-height:22px;color:#4b5563;">
      {{activationMessage}}
    </td>
  </tr>
</table>
`;

export const buildPlanActivationTemplate = (
  data: PlanActivationTemplateData,
) => {
  const brandName = data.brandName ?? "BillSutra";
  const activationMessage =
    data.activationMessage ??
    "You can now access all the features included in your plan.";
  const html = renderEmailLayout({
    title: `${brandName} plan activation`,
    preheader: `${data.planName} plan is now active`,
    bodyHtml: renderTemplate(planBodyTemplate, {
      ...data,
      activationMessage,
    }),
  });

  return {
    subject: `${brandName} ${data.planName} plan activated`,
    html,
    text: `Your ${data.planName} plan is active. Validity: ${data.validity}. ${activationMessage}`,
  };
};
