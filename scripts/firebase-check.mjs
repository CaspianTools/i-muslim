// Local diagnostic: verifies Firebase Admin SDK creds can reach the named
// "main" Firestore database. Reads .env.local manually; no Next.js needed.
// Run: `node scripts/firebase-check.mjs`. Safe to delete after.
import { readFileSync } from "node:fs";

const env = Object.create(null);
try {
  for (const raw of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[key] = value;
  }
} catch (e) {
  console.error("[fail] cannot read .env.local:", e.message);
  process.exit(1);
}

const need = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
const missing = need.filter((k) => !env[k]);
if (missing.length) {
  console.error("[fail] missing in .env.local:", missing.join(", "));
  process.exit(1);
}

const databaseId = env.FIREBASE_DATABASE_ID || "main";
const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

const { cert, getApps, initializeApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const { getAuth } = await import("firebase-admin/auth");

const APP_NAME = "i-muslim-check";
const app =
  getApps().find((a) => a.name === APP_NAME) ??
  initializeApp(
    {
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    },
    APP_NAME,
  );

console.log(`[ok]  initialized app for project=${env.FIREBASE_PROJECT_ID}, db=${databaseId}`);

try {
  const auth = getAuth(app);
  await auth.listUsers(1);
  console.log("[ok]  Firebase Auth Admin SDK callable (listUsers)");
} catch (e) {
  console.error("[fail] Firebase Auth probe:", e.message);
  process.exit(2);
}

try {
  const db = getFirestore(app, databaseId);
  const snap = await db.collection("users").limit(1).get();
  console.log(
    `[ok]  Firestore reachable; "users" collection has ${snap.size === 0 ? "no docs yet (or empty page)" : `at least ${snap.size} doc`}`,
  );
} catch (e) {
  console.error("[fail] Firestore probe:", e.message);
  if (/database.*not.*found/i.test(e.message)) {
    console.error("       → Make sure database id is correct (currently:", databaseId + ")");
  }
  if (/permission/i.test(e.message) || /denied/i.test(e.message)) {
    console.error("       → The service account may need the Cloud Datastore User role.");
  }
  process.exit(3);
}

console.log("[done] All Firebase checks passed.");
