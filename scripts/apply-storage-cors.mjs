// Applies storage-cors.json to the Firebase Storage bucket so signed-URL
// PUTs from the browser (admin Media uploads) clear preflight. Reads creds
// from .env.local. Run: `node scripts/apply-storage-cors.mjs`.
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

const bucketName =
  env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${env.FIREBASE_PROJECT_ID}.appspot.com`;

const corsConfig = JSON.parse(readFileSync("storage-cors.json", "utf8"));
const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

const { cert, getApps, initializeApp } = await import("firebase-admin/app");
const { getStorage } = await import("firebase-admin/storage");

const APP_NAME = "i-muslim-cors";
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

const bucket = getStorage(app).bucket(bucketName);
console.log(`[info] applying CORS to gs://${bucketName}`);
console.log(JSON.stringify(corsConfig, null, 2));

await bucket.setCorsConfiguration(corsConfig);

const [meta] = await bucket.getMetadata();
console.log("[ok]   bucket CORS now set to:");
console.log(JSON.stringify(meta.cors ?? [], null, 2));
