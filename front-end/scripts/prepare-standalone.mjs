import fs from "node:fs";
import path from "node:path";

const appDir = process.cwd();
const standaloneAppDir = path.join(appDir, ".next", "standalone", "front-end");

if (!fs.existsSync(standaloneAppDir)) {
  console.warn(
    "[prepare-standalone] Skipped because .next/standalone/front-end does not exist.",
  );
  process.exit(0);
}

const copyIfExists = (from, to) => {
  if (!fs.existsSync(from)) {
    return;
  }

  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
};

copyIfExists(
  path.join(appDir, "public"),
  path.join(standaloneAppDir, "public"),
);
copyIfExists(
  path.join(appDir, ".next", "static"),
  path.join(standaloneAppDir, ".next", "static"),
);
