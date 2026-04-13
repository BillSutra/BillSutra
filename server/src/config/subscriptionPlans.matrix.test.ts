import assert from "node:assert/strict";
import test from "node:test";
import {
  SUBSCRIPTION_PLAN_CONFIG,
  featureRequiredPlan,
  isPlanAtLeast,
  type SubscriptionFeatureKey,
  type SubscriptionPlanId,
} from "./subscriptionPlans.js";

const ALL_FEATURES: SubscriptionFeatureKey[] = [
  "INVOICE_CREATE",
  "PAYMENT_TRACKING",
  "SMART_SUGGESTIONS",
  "REPORTS_BASIC",
  "ANALYTICS_ADVANCED",
  "REPORTS_ADVANCED",
  "WORKERS_MANAGEMENT",
  "DATA_EXPORT",
];

test("plan matrix enforces free/pro/pro-plus expectations", () => {
  const expected: Record<
    SubscriptionPlanId,
    Record<SubscriptionFeatureKey, boolean>
  > = {
    free: {
      INVOICE_CREATE: true,
      PAYMENT_TRACKING: false,
      SMART_SUGGESTIONS: false,
      REPORTS_BASIC: false,
      ANALYTICS_ADVANCED: false,
      REPORTS_ADVANCED: false,
      WORKERS_MANAGEMENT: false,
      DATA_EXPORT: false,
    },
    pro: {
      INVOICE_CREATE: true,
      PAYMENT_TRACKING: true,
      SMART_SUGGESTIONS: true,
      REPORTS_BASIC: true,
      ANALYTICS_ADVANCED: false,
      REPORTS_ADVANCED: false,
      WORKERS_MANAGEMENT: false,
      DATA_EXPORT: false,
    },
    "pro-plus": {
      INVOICE_CREATE: true,
      PAYMENT_TRACKING: true,
      SMART_SUGGESTIONS: true,
      REPORTS_BASIC: true,
      ANALYTICS_ADVANCED: true,
      REPORTS_ADVANCED: true,
      WORKERS_MANAGEMENT: true,
      DATA_EXPORT: true,
    },
  };

  (Object.keys(expected) as SubscriptionPlanId[]).forEach((planId) => {
    ALL_FEATURES.forEach((feature) => {
      assert.equal(
        SUBSCRIPTION_PLAN_CONFIG[planId].features[feature],
        expected[planId][feature],
        `${planId} feature ${feature} mismatch`,
      );
    });
  });
});

test("feature required-plan mapping matches pricing tiers", () => {
  assert.equal(featureRequiredPlan.PAYMENT_TRACKING, "pro");
  assert.equal(featureRequiredPlan.SMART_SUGGESTIONS, "pro");
  assert.equal(featureRequiredPlan.REPORTS_BASIC, "pro");

  assert.equal(featureRequiredPlan.ANALYTICS_ADVANCED, "pro-plus");
  assert.equal(featureRequiredPlan.REPORTS_ADVANCED, "pro-plus");
  assert.equal(featureRequiredPlan.WORKERS_MANAGEMENT, "pro-plus");
  assert.equal(featureRequiredPlan.DATA_EXPORT, "pro-plus");
});

test("plan hierarchy ordering remains monotonic", () => {
  assert.equal(isPlanAtLeast("free", "free"), true);
  assert.equal(isPlanAtLeast("pro", "free"), true);
  assert.equal(isPlanAtLeast("pro-plus", "pro"), true);

  assert.equal(isPlanAtLeast("free", "pro"), false);
  assert.equal(isPlanAtLeast("pro", "pro-plus"), false);
});
