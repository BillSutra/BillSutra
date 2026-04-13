Implement a robust subscription check system in my billing app (BillSutra) to determine whether a user is subscribed, which plan they are on, and what features they are allowed to access.

CURRENT PROBLEM:

* No centralized way to check subscription status
* Features are not gated properly
* No clear logic for plan-based access

GOAL:

* Create a reusable system to:

  1. Check if user is subscribed
  2. Identify current plan
  3. Return allowed features/services
  4. Handle expired or trial users

---

1. FUNCTION: CHECK SUBSCRIPTION STATUS

Create a reusable function:

getUserSubscription(businessId)

Return:

{
isSubscribed: boolean,
plan: "free" | "pro" | "pro_plus",
status: "trial" | "active" | "expired" | "cancelled",
trialEndsAt?: Date,
endDate?: Date
}

Logic:

* If no subscription → default to FREE
* If trial active → status = "trial"
* If current date > endDate → status = "expired"
* If active → status = "active"

---

2. FUNCTION: GET FEATURE ACCESS

Create helper:

getFeatureAccess(plan)

Return allowed features:

Example:

FREE:

* maxInvoices: 50
* analytics: false
* teamAccess: false
* export: false

PRO:

* maxInvoices: unlimited
* analytics: basic
* teamAccess: false
* export: true

PRO_PLUS:

* maxInvoices: unlimited
* analytics: advanced
* teamAccess: true
* export: true

---

3. COMBINED FUNCTION (MAIN)

Create:

getUserPermissions(businessId)

Return:

{
plan: string,
isSubscribed: boolean,
features: {
maxInvoices: number | "unlimited",
analytics: boolean | "advanced",
teamAccess: boolean,
export: boolean
},
usage: {
invoicesUsed: number
},
limitsReached: {
invoicesLimitReached: boolean
}
}

---

4. FEATURE GATING (IMPORTANT)

Before any action:

Example:

if (!permissions.features.export) {
return error("Upgrade to Pro to export data")
}

Example:
if (permissions.limitsReached.invoicesLimitReached) {
showUpgradeModal()
}

---

5. AUTO DOWNGRADE LOGIC

* If subscription expired:
  → fallback to FREE plan
  → restrict features immediately

---

6. FRONTEND USAGE

* Show current plan badge

* Show usage:
  "32 / 50 invoices used"

* Conditionally render features:

  * Hide analytics if not allowed
  * Disable export button if not allowed

---

7. UPGRADE PROMPTS

When user hits limit:

Show modal:
"You’ve reached your plan limit"
"Upgrade to Pro for unlimited access"

CTA:
Upgrade Now

---

8. PERFORMANCE

* Cache subscription + permissions
* Avoid querying DB repeatedly

---

EXPECTED RESULT:

* Centralized subscription logic
* Clean feature gating
* Real-time plan awareness
* Scalable SaaS architecture

---

Implement using reusable services, clean backend logic, and proper validation.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(projectRoot);

const nextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});