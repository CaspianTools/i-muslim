/**
 * Keep every locale's translation tree shaped like the base (`en`) locale.
 *
 * Run: npm run sync:locales
 *
 * Two passes — both apply the same shape-mirroring rules:
 *   - Add missing keys with the base locale's value as a placeholder so the
 *     locale stops falling back partial-English at runtime — the placeholder
 *     itself is rendered, which gives the admin a visible "needs translation"
 *     signal during normal browsing.
 *   - Remove keys that no longer exist in the base (avoids stale accumulation).
 *   - Leave already-translated values untouched.
 *
 * Pass 1 — disk-locales: rewrites `messages/<code>.json` for every bundled
 * locale on disk except the base. Runs offline; no Firestore credentials
 * needed. Prevents fully-missing keys from rendering as raw `foo.bar` paths
 * when en.json grows but a developer forgets to mirror the new keys.
 *
 * Pass 2 — Firestore-locales: rewrites `config/uiLocales/locales/{code}`
 * docs for activated reserved locales. Requires Firebase admin env vars; if
 * they are missing, this pass is skipped with a warning and the disk pass
 * still completes.
 *
 * Both passes are idempotent. No writes happen if the patched value equals
 * the existing one.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import {
  Timestamp,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

type Json = unknown;
type JsonObject = Record<string, Json>;

const FIRESTORE_ENV_VARS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;

function missingFirestoreEnv(): string[] {
  return FIRESTORE_ENV_VARS.filter((n) => !process.env[n]);
}

function db(): Firestore {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID!;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n");
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore(getApp(), process.env.FIREBASE_DATABASE_ID ?? "main");
}

function loadBundled(code: string): JsonObject {
  const path = resolve(process.cwd(), "messages", `${code}.json`);
  if (!existsSync(path)) {
    throw new Error(`messages/${code}.json not found`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

function isPlainObject(v: Json): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type Counts = { added: number; removed: number; preserved: number };

function emptyCounts(): Counts {
  return { added: 0, removed: 0, preserved: 0 };
}

// Top-level keys starting with `_` (e.g. `_meta`) are per-locale metadata —
// not translation keys — and shouldn't be subject to base-shape mirroring.
// Strip them off the overlay before reshape, then re-attach them on the
// patched output so they survive sync runs.
function reshapeWithMeta(
  base: JsonObject,
  overlay: JsonObject,
  counts: Counts,
): JsonObject {
  const meta: JsonObject = {};
  const stripped: JsonObject = {};
  for (const [k, v] of Object.entries(overlay)) {
    if (k.startsWith("_")) meta[k] = v;
    else stripped[k] = v;
  }
  const patched = reshape(base, stripped, counts) as JsonObject;
  // Prepend meta keys so they stay at the top of the JSON file.
  return { ...meta, ...patched };
}

// Walk `base` and produce a patched object shaped like `base` but with values
// from `overlay` where they exist. Missing keys → base value. Keys present in
// `overlay` but not in `base` → dropped. Mutates `counts` for diagnostics.
function reshape(base: Json, overlay: Json | undefined, counts: Counts): Json {
  if (isPlainObject(base)) {
    const out: JsonObject = {};
    const overlayObj = isPlainObject(overlay) ? overlay : undefined;

    if (overlayObj) {
      for (const k of Object.keys(overlayObj)) {
        if (!(k in base)) counts.removed++;
      }
    }

    for (const k of Object.keys(base)) {
      const baseVal = base[k];
      const overlayVal = overlayObj ? overlayObj[k] : undefined;
      if (overlayVal === undefined) {
        // Whole subtree missing in overlay → counts every leaf in base.
        countAdded(baseVal, counts);
        out[k] = baseVal;
      } else {
        out[k] = reshape(baseVal, overlayVal, counts);
      }
    }
    return out;
  }

  // Leaf. base is a string/number/boolean/null. Use overlay if present,
  // otherwise fall back to base (placeholder).
  if (overlay === undefined) {
    counts.added++;
    return base;
  }
  // Overlay present and base is a leaf: prefer overlay.
  counts.preserved++;
  return overlay;
}

function countAdded(value: Json, counts: Counts): void {
  if (isPlainObject(value)) {
    for (const v of Object.values(value)) countAdded(v, counts);
  } else {
    counts.added++;
  }
}

function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!(k in b)) return false;
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

const BASE_LOCALE = "en";

function listOnDiskLocales(): string[] {
  const dir = resolve(process.cwd(), "messages");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .filter((code) => code !== BASE_LOCALE)
    .sort();
}

function syncDiskLocales(base: JsonObject): void {
  const codes = listOnDiskLocales();
  if (codes.length === 0) {
    console.log("[disk] no on-disk locales beyond base — skipping disk pass.");
    return;
  }
  console.log(
    `[disk] reshaping ${codes.length} on-disk locale${codes.length === 1 ? "" : "s"} against ${BASE_LOCALE}: ${codes.join(", ")}`,
  );

  let touched = 0;
  for (const code of codes) {
    const filePath = resolve(process.cwd(), "messages", `${code}.json`);
    let overlay: JsonObject;
    try {
      overlay = JSON.parse(readFileSync(filePath, "utf8")) as JsonObject;
    } catch (err) {
      console.warn(`[disk:${code}] could not parse — skipping. (${(err as Error).message})`);
      continue;
    }
    const counts = emptyCounts();
    const patched = reshapeWithMeta(base, overlay, counts);
    if (deepEqual(patched, overlay)) {
      console.log(`[disk:${code}] up to date (${counts.preserved} preserved).`);
      continue;
    }
    writeFileSync(filePath, JSON.stringify(patched, null, 2) + "\n", "utf8");
    touched++;
    console.log(
      `[disk:${code}] wrote — added ${counts.added}, removed ${counts.removed}, preserved ${counts.preserved}.`,
    );
  }
  console.log(
    touched === 0
      ? "[disk] done. Nothing to write."
      : `[disk] done. Wrote ${touched} locale file${touched === 1 ? "" : "s"}.`,
  );
}

async function syncFirestoreLocales(base: JsonObject): Promise<void> {
  const firestore = db();
  console.log(
    `[fs] connecting to Firestore project=${process.env.FIREBASE_PROJECT_ID} db=${process.env.FIREBASE_DATABASE_ID ?? "main"}`,
  );

  const localesCol = firestore
    .collection("config")
    .doc("uiLocales")
    .collection("locales");
  const snap = await localesCol.get();
  const activated = snap.docs.filter((d) => d.data()?.activated === true);

  if (activated.length === 0) {
    console.log("[fs] no activated reserved locales — nothing to sync.");
    return;
  }
  console.log(
    `[fs] found ${activated.length} activated locale${activated.length === 1 ? "" : "s"}: ${activated.map((d) => d.id).join(", ")}`,
  );

  // Cache base JSONs since multiple locales likely share `en` as their base.
  // The default base is already loaded; lazy-load any other base locales referenced.
  const baseCache = new Map<string, JsonObject>([[BASE_LOCALE, base]]);
  function getBase(code: string): JsonObject {
    let m = baseCache.get(code);
    if (!m) {
      m = loadBundled(code);
      baseCache.set(code, m);
    }
    return m;
  }

  let touched = 0;
  for (const doc of activated) {
    const code = doc.id;
    const data = doc.data() ?? {};
    const baseLocale =
      typeof data.baseLocale === "string" && data.baseLocale.length > 0
        ? data.baseLocale
        : BASE_LOCALE;
    let docBase: JsonObject;
    try {
      docBase = getBase(baseLocale);
    } catch (err) {
      console.warn(
        `[fs:${code}] base locale "${baseLocale}" not found on disk — skipping. (${(err as Error).message})`,
      );
      continue;
    }

    const overlay = isPlainObject(data.messages) ? (data.messages as JsonObject) : {};
    const counts = emptyCounts();
    const patched = reshapeWithMeta(docBase, overlay, counts);

    if (deepEqual(patched, overlay)) {
      console.log(`[fs:${code}] up to date (${counts.preserved} preserved).`);
      continue;
    }

    await localesCol.doc(code).set(
      {
        messages: patched,
        syncedAt: Timestamp.now(),
      },
      { merge: true },
    );
    touched++;
    console.log(
      `[fs:${code}] synced — added ${counts.added}, removed ${counts.removed}, preserved ${counts.preserved}.`,
    );
  }

  console.log(
    touched === 0
      ? "[fs] done. Nothing to write."
      : `[fs] done. Wrote ${touched} locale doc${touched === 1 ? "" : "s"}.`,
  );
}

async function main() {
  const base = loadBundled(BASE_LOCALE);

  syncDiskLocales(base);

  const missingEnv = missingFirestoreEnv();
  if (missingEnv.length > 0) {
    console.warn(
      `[fs] skipping Firestore pass — missing env: ${missingEnv.join(", ")} (check .env.local).`,
    );
    process.exit(0);
  }

  await syncFirestoreLocales(base);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
