/**
 * Verify bundled non-English locales have leaf-key parity with `messages/en.json`.
 *
 * Run: npm run check:locales              (checks Turkish only — default)
 *      npm run check:locales -- --all     (also checks ar and id)
 *
 * Exits non-zero if any target locale is missing keys present in English.
 * Extra keys (present in target but not English) are reported as warnings —
 * they do not fail the check, since stale-key removal is a separate concern.
 *
 * Skips the `_meta` namespace, which is reserved for translator review notes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Json = unknown;
type JsonObject = Record<string, Json>;

const REPO_ROOT = resolve(__dirname, "..");
const MESSAGES_DIR = resolve(REPO_ROOT, "messages");

function loadLocale(code: string): JsonObject {
  const path = resolve(MESSAGES_DIR, `${code}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

function flattenLeafKeys(
  obj: JsonObject,
  prefix = "",
  out: string[] = [],
): string[] {
  for (const [key, value] of Object.entries(obj)) {
    if (key === "_meta") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flattenLeafKeys(value as JsonObject, path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}

function diffKeys(base: string[], target: string[]): {
  missing: string[];
  extra: string[];
} {
  const baseSet = new Set(base);
  const targetSet = new Set(target);
  return {
    missing: base.filter((k) => !targetSet.has(k)),
    extra: target.filter((k) => !baseSet.has(k)),
  };
}

function checkLocale(code: string, baseKeys: string[]): boolean {
  const targetKeys = flattenLeafKeys(loadLocale(code));
  const { missing, extra } = diffKeys(baseKeys, targetKeys);

  if (missing.length === 0 && extra.length === 0) {
    console.log(`  ${code}: ✓ ${targetKeys.length} keys, full parity`);
    return true;
  }

  if (missing.length > 0) {
    console.log(
      `  ${code}: ✗ ${missing.length} missing key${missing.length === 1 ? "" : "s"} (of ${baseKeys.length} in en):`,
    );
    for (const k of missing) console.log(`      ${k}`);
  }
  if (extra.length > 0) {
    console.log(
      `  ${code}: ⚠ ${extra.length} extra key${extra.length === 1 ? "" : "s"} (in ${code} but not en):`,
    );
    for (const k of extra) console.log(`      ${k}`);
  }
  return missing.length === 0;
}

const args = process.argv.slice(2);
const checkAll = args.includes("--all");
const targets = checkAll ? ["tr", "ar", "id"] : ["tr"];

console.log(
  `Checking locale parity against en.json (${checkAll ? "all bundled" : "tr only — pass --all to include ar, id"})…`,
);

const baseKeys = flattenLeafKeys(loadLocale("en"));
console.log(`  en: ${baseKeys.length} leaf keys (source of truth)`);

let allOk = true;
for (const code of targets) {
  if (!checkLocale(code, baseKeys)) allOk = false;
}

if (!allOk) {
  console.error(
    "\nLocale parity check failed. Add the missing keys to the listed locale file(s).",
  );
  process.exit(1);
}
console.log("\nAll checked locales have full parity with en.json.");
