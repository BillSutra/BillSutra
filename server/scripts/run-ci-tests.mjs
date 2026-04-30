import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const sharedEnv = {
  ...process.env,
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  REDIS_URL: "",
  REDIS_HOST: "",
  REDIS_PORT: "",
  REDIS_USERNAME: "",
  REDIS_PASSWORD: "",
  REDIS_TOKEN: "",
  REDIS_DB: "",
  REDIS_TLS: "",
  USE_REDIS_CACHE: "false",
  USE_REDIS_RATE_LIMIT: "false",
  USE_QUEUE: "false",
};

const testScripts = [
  "test:database-url",
  "test:redis-config",
  "test:security-env",
  "test:invoice-calculations",
  "test:csrf",
  "test:assistant-parser",
  "test:assistant-integration",
  "test:assistant-chatflow",
  "test:subscription-access",
  "test:settings-security",
];

for (const scriptName of testScripts) {
  const result = spawnSync(npmCommand, ["run", scriptName], {
    cwd: process.cwd(),
    env: sharedEnv,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
