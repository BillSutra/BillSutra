import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const serverSrcRoot = join(process.cwd(), "src");
const routesFile = join(serverSrcRoot, "routes", "index.ts");
const invoiceRoutesFile = join(
  serverSrcRoot,
  "modules",
  "invoice",
  "invoice.routes.ts",
);

const read = (path: string) => readFileSync(path, "utf8");

const assertContains = (content: string, snippet: string, label: string) => {
  assert.ok(content.includes(snippet), `Missing contract: ${label}`);
};

test("critical subscription feature gates remain wired in route layer", () => {
  const content = read(routesFile);

  assertContains(
    content,
    'RequireFeatureAccessMiddleware("WORKERS_MANAGEMENT")',
    "workers routes require pro-plus",
  );
  assertContains(
    content,
    'RequireFeatureAccessMiddleware("DATA_EXPORT")',
    "export routes require pro-plus",
  );
  assertContains(
    content,
    'RequireFeatureAccessMiddleware("ANALYTICS_ADVANCED")',
    "analytics requires pro-plus",
  );

  assertContains(
    content,
    'RequireFeatureAccessMiddleware("REPORTS_BASIC")',
    "reports summary requires pro",
  );
  assertContains(
    content,
    'RequireFeatureAccessMiddleware("PAYMENT_TRACKING")',
    "payment endpoints require pro",
  );
  assertContains(
    content,
    'RequireFeatureAccessMiddleware("SMART_SUGGESTIONS")',
    "assistant/copilot requires pro",
  );
});

test("invoice creation stays protected by subscription gating", () => {
  const content = read(invoiceRoutesFile);
  assertContains(
    content,
    'RequireFeatureAccessMiddleware("INVOICE_CREATE")',
    "invoice create route must enforce usage-limited feature",
  );
});
