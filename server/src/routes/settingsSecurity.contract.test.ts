import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const serverSrcRoot = join(process.cwd(), "src");
const routesFile = join(serverSrcRoot, "routes", "index.ts");
const authMiddlewareFile = join(
  serverSrcRoot,
  "middlewares",
  "AuthMIddleware.ts",
);
const settingsControllerFile = join(
  serverSrcRoot,
  "controllers",
  "SettingsController.ts",
);

const read = (path: string) => readFileSync(path, "utf8");

const assertContains = (content: string, snippet: string, label: string) => {
  assert.ok(content.includes(snippet), `Missing contract: ${label}`);
};

test("settings and security routes remain registered", () => {
  const content = read(routesFile);

  assertContains(
    content,
    '"/settings/preferences"',
    "settings preferences route path",
  );
  assertContains(
    content,
    "SettingsController.preferences",
    "get preferences controller",
  );
  assertContains(
    content,
    "SettingsController.savePreferences",
    "save preferences controller",
  );

  assertContains(
    content,
    '"/security/activity"',
    "security activity route path",
  );
  assertContains(
    content,
    "SettingsController.securityActivity",
    "security activity controller",
  );

  assertContains(content, '"/security/logout-all"', "logout-all route path");
  assertContains(
    content,
    "SettingsController.logoutAll",
    "logout-all controller",
  );
});

test("auth middleware keeps session-version revocation check", () => {
  const content = read(authMiddlewareFile);

  assertContains(
    content,
    "session_version",
    "session version read from database",
  );
  assertContains(
    content,
    "authUser.sessionVersion",
    "token session version comparison",
  );
  assertContains(
    content,
    "Session expired. Please login again.",
    "stale token rejection message",
  );
});

test("settings controller keeps required handlers", () => {
  const content = read(settingsControllerFile);

  assertContains(content, "static async preferences", "preferences handler");
  assertContains(
    content,
    "static async savePreferences",
    "save preferences handler",
  );
  assertContains(
    content,
    "static async securityActivity",
    "security activity handler",
  );
  assertContains(content, "static async logoutAll", "logout all handler");
});
