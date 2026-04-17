import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");
const sourceRoot = path.join(workspaceRoot, "src");
const localePaths = {
  en: path.join(workspaceRoot, "locales", "en.json"),
  hi: path.join(workspaceRoot, "locales", "hi.json"),
};
const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);
const ignoreDirs = new Set([
  ".next",
  "node_modules",
  "i18n",
  "locales",
  "__tests__",
]);
const attrPattern =
  /\b(placeholder|title|aria-label|aria-description|alt)\s*=\s*"([^"{][^"]*[A-Za-z\u0900-\u097F][^"]*)"/g;
const textPattern = />\s*([^<>{]*[A-Za-z\u0900-\u097F][^<>{]*)\s*</g;
const translationCallPattern = /\b(?:safeT|t)\(\s*["'`]([^"'`$]+)["'`]/g;
const syncHi = process.argv.includes("--sync-hi");

const loadJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const flattenKeys = (value, prefix = "", result = new Map()) => {
  if (!isPlainObject(value)) {
    return result;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(nestedValue)) {
      flattenKeys(nestedValue, nextKey, result);
      continue;
    }

    result.set(nextKey, nestedValue);
  }

  return result;
};

const setNestedValue = (target, keyPath, value) => {
  const segments = keyPath.split(".");
  let current = target;

  segments.forEach((segment, index) => {
    const isLeaf = index === segments.length - 1;
    if (isLeaf) {
      current[segment] = value;
      return;
    }

    if (!isPlainObject(current[segment])) {
      current[segment] = {};
    }

    current = current[segment];
  });
};

const shouldSkipLine = (line) =>
  line.includes("t(") ||
  line.includes("safeT(") ||
  line.includes("{t(") ||
  line.includes("{safeT(") ||
  line.includes("console.") ||
  line.includes("href=") ||
  line.includes("queryKey") ||
  line.includes("className=") ||
  line.includes("import ") ||
  line.includes("export ");

const walk = (dir, visitor) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, visitor);
      continue;
    }

    if (!exts.has(path.extname(entry.name))) continue;
    visitor(fullPath);
  }
};

if (!fs.existsSync(sourceRoot)) {
  console.error(`Missing source directory: ${sourceRoot}`);
  process.exit(1);
}

const en = loadJson(localePaths.en);
const hi = loadJson(localePaths.hi);
const enKeys = flattenKeys(en);
const hiKeys = flattenKeys(hi);

const missingInHi = [...enKeys.keys()].filter((key) => {
  if (!hiKeys.has(key)) return true;
  const hiValue = hiKeys.get(key);
  return typeof hiValue !== "string" || hiValue.trim().length === 0;
});
const extraInHi = [...hiKeys.keys()].filter((key) => !enKeys.has(key));
const emptyInEn = [...enKeys.entries()]
  .filter(([, value]) => typeof value !== "string" || value.trim().length === 0)
  .map(([key]) => key);

if (syncHi && missingInHi.length > 0) {
  for (const key of missingInHi) {
    setNestedValue(hi, key, enKeys.get(key));
  }

  fs.writeFileSync(localePaths.hi, `${JSON.stringify(hi, null, 2)}\n`, "utf8");
}

const missingLiteralKeys = new Map();
const rawUiStrings = [];

walk(sourceRoot, (filePath) => {
  const contents = fs.readFileSync(filePath, "utf8");
  const lines = contents.split(/\r?\n/);

  for (const match of contents.matchAll(translationCallPattern)) {
    const key = match[1].trim();
    if (!key || !/^[A-Za-z0-9_.-]+$/.test(key)) continue;
    if (!enKeys.has(key)) {
      const current = missingLiteralKeys.get(key) ?? [];
      current.push(path.relative(workspaceRoot, filePath));
      missingLiteralKeys.set(key, current);
    }
  }

  lines.forEach((line, index) => {
    if (shouldSkipLine(line)) return;

    for (const match of line.matchAll(attrPattern)) {
      rawUiStrings.push({
        file: path.relative(workspaceRoot, filePath),
        line: index + 1,
        text: match[2].trim(),
      });
    }

    for (const match of line.matchAll(textPattern)) {
      const text = match[1].trim();
      if (!text) continue;
      if (/^[\W\d_]+$/.test(text)) continue;
      if (text.startsWith("//")) continue;
      rawUiStrings.push({
        file: path.relative(workspaceRoot, filePath),
        line: index + 1,
        text,
      });
    }
  });
});

let hasBlockingIssues = false;

if (syncHi && missingInHi.length > 0) {
  console.log(`Synced ${missingInHi.length} Hindi key(s) from English.`);
}

if (missingInHi.length > 0) {
  hasBlockingIssues = !syncHi;
  console.error(
    `Missing Hindi translation keys (${missingInHi.length}):`,
  );
  missingInHi.slice(0, 200).forEach((key) => console.error(`  ${key}`));
}

if (extraInHi.length > 0) {
  hasBlockingIssues = true;
  console.error(`Extra Hindi translation keys (${extraInHi.length}):`);
  extraInHi.slice(0, 200).forEach((key) => console.error(`  ${key}`));
}

if (emptyInEn.length > 0) {
  hasBlockingIssues = true;
  console.error(`Empty English translation values (${emptyInEn.length}):`);
  emptyInEn.slice(0, 200).forEach((key) => console.error(`  ${key}`));
}

if (missingLiteralKeys.size > 0) {
  hasBlockingIssues = true;
  console.error(`Missing literal translation keys in code (${missingLiteralKeys.size}):`);
  [...missingLiteralKeys.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 200)
    .forEach(([key, files]) => {
      console.error(`  ${key}`);
      [...new Set(files)].slice(0, 5).forEach((file) => console.error(`    ${file}`));
    });
}

if (rawUiStrings.length > 0) {
  console.warn(`Possible untranslated UI strings (${rawUiStrings.length}):`);
  rawUiStrings.slice(0, 80).forEach((issue) => {
    console.warn(`  ${issue.file}:${issue.line}  ${issue.text}`);
  });
  if (rawUiStrings.length > 80) {
    console.warn(`  ...and ${rawUiStrings.length - 80} more.`);
  }
}

if (!hasBlockingIssues) {
  console.log("i18n check passed.");
}

process.exit(hasBlockingIssues ? 1 : 0);
