/**
 * One-shot migration: convert legacy free-text profile.country values to ISO-3166
 * alpha-2 codes. Idempotent — re-runs skip already-ISO-2 fields.
 *
 *   users/{uid}.profile.country         "Saudi Arabia" → "SA"
 *   matrimonialProfiles/{id}.country    "Saudi Arabia" → "SA"
 *
 * Run:
 *   npm run migrate:country-iso2 -- --dry-run    (preview only)
 *   npm run migrate:country-iso2                 (write)
 *
 * Unmappable values are blanked out and logged so the user can repick on next
 * profile edit.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
countries.registerLocale(enLocale);

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name} (check .env.local)`);
    process.exit(1);
  }
  return v;
}

function db(): Firestore {
  if (!getApps().length) {
    const projectId = required("FIREBASE_PROJECT_ID");
    const clientEmail = required("FIREBASE_CLIENT_EMAIL");
    const privateKey = required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore(getApp(), process.env.FIREBASE_DATABASE_ID ?? "main");
}

function toIso2(raw: unknown): { code: string; status: "iso2" | "mapped" | "blank" | "unmapped" } {
  if (typeof raw !== "string") return { code: "", status: "blank" };
  const trimmed = raw.trim();
  if (!trimmed) return { code: "", status: "blank" };
  if (/^[A-Za-z]{2}$/.test(trimmed) && countries.isValid(trimmed.toUpperCase())) {
    return { code: trimmed.toUpperCase(), status: "iso2" };
  }
  const code = countries.getAlpha2Code(trimmed, "en");
  if (code) return { code, status: "mapped" };
  return { code: "", status: "unmapped" };
}

interface Counts {
  scanned: number;
  alreadyIso2: number;
  mapped: number;
  blanked: number;
  unmapped: Array<{ id: string; raw: string }>;
}

function emptyCounts(): Counts {
  return { scanned: 0, alreadyIso2: 0, mapped: 0, blanked: 0, unmapped: [] };
}

async function migrateCollection(
  firestore: Firestore,
  collectionPath: string,
  fieldPath: string,
  dryRun: boolean,
): Promise<Counts> {
  const counts = emptyCounts();
  const segments = collectionPath.split("/");
  if (segments.length !== 1) {
    throw new Error(`Top-level collection expected, got ${collectionPath}`);
  }
  const snap = await firestore.collection(collectionPath).get();
  for (const doc of snap.docs) {
    counts.scanned++;
    const raw = fieldPath.split(".").reduce<unknown>((acc, seg) => {
      if (acc && typeof acc === "object" && seg in acc) {
        return (acc as Record<string, unknown>)[seg];
      }
      return undefined;
    }, doc.data());
    const { code, status } = toIso2(raw);
    if (status === "iso2") {
      counts.alreadyIso2++;
      continue;
    }
    if (status === "blank") {
      continue;
    }
    if (status === "unmapped") {
      counts.unmapped.push({ id: doc.id, raw: String(raw) });
      if (!dryRun) await doc.ref.update({ [fieldPath]: "" });
      counts.blanked++;
      continue;
    }
    if (!dryRun) await doc.ref.update({ [fieldPath]: code });
    counts.mapped++;
  }
  return counts;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(
    `migrate-profile-country-to-iso2 (${dryRun ? "DRY RUN" : "WRITE"}) — project=${process.env.FIREBASE_PROJECT_ID} db=${process.env.FIREBASE_DATABASE_ID ?? "main"}`,
  );

  const firestore = db();

  console.log("\n== users/*.profile.country ==");
  const userCounts = await migrateCollection(firestore, "users", "profile.country", dryRun);
  printCounts(userCounts);

  console.log("\n== matrimonialProfiles/*.country ==");
  const matCounts = await migrateCollection(firestore, "matrimonialProfiles", "country", dryRun);
  printCounts(matCounts);

  console.log(
    `\nTotal scanned: ${userCounts.scanned + matCounts.scanned}, mapped: ${userCounts.mapped + matCounts.mapped}, blanked: ${userCounts.blanked + matCounts.blanked}.`,
  );
  if (dryRun) console.log("(Dry run — nothing was written.)");
  process.exit(0);
}

function printCounts(c: Counts) {
  console.log(
    `  scanned=${c.scanned} alreadyIso2=${c.alreadyIso2} mapped=${c.mapped} blanked=${c.blanked}`,
  );
  if (c.unmapped.length > 0) {
    console.log(`  unmapped (${c.unmapped.length}):`);
    for (const u of c.unmapped.slice(0, 30)) {
      console.log(`    - ${u.id}: ${JSON.stringify(u.raw)}`);
    }
    if (c.unmapped.length > 30) console.log(`    … and ${c.unmapped.length - 30} more`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
