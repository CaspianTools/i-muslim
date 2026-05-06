/**
 * Seed Firestore with the built-in roles for the RBAC system, then assign
 * the Keymaster role to the project owner.
 *
 * Usage:
 *   npm run seed:roles
 *
 * Idempotency:
 *   - `keymaster` is re-asserted on every run (permissions always "*",
 *     protected, builtIn). Ensures it can never drift.
 *   - `admin`, `moderator`, `translator`, `member` are created if missing.
 *     On re-runs, admin-edited permission sets are preserved; only the
 *     `builtIn` and `protected` flags are corrected.
 *   - The Keymaster user assignment is upserted via merge. Any other user
 *     accidentally holding `keymaster` is demoted to `admin` and logged.
 *
 * Configure the keymaster email via the KEYMASTER_EMAIL env var; defaults
 * to fuad.jalilov@gmail.com (the project owner) if unset.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";

import {
  BUILT_IN_ROLES,
  KEYMASTER_ROLE_ID,
} from "../lib/permissions/built-in-roles";
import { WILDCARD } from "../lib/permissions/catalog";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const DEFAULT_KEYMASTER_EMAIL = "fuad.jalilov@gmail.com";
const ROLES_COLLECTION = "roles";
const USERS_COLLECTION = "users";

function init(): { db: Firestore; auth: ReturnType<typeof getAuth> } {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local",
    );
    process.exit(1);
  }
  const app =
    getApps().length === 0
      ? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
      : getApp();
  const databaseId = process.env.FIREBASE_DATABASE_ID || "main";
  return { db: getFirestore(app, databaseId), auth: getAuth(app) };
}

async function seedRoles(db: Firestore): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const spec of BUILT_IN_ROLES) {
    const ref = db.collection(ROLES_COLLECTION).doc(spec.id);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        name: spec.name,
        description: spec.description,
        permissions: spec.permissions,
        builtIn: true,
        protected: spec.protected,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`  + created  ${spec.id}`);
      created++;
      continue;
    }

    const data = snap.data() ?? {};
    const patch: Record<string, unknown> = {
      builtIn: true,
      protected: spec.protected,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (typeof data.name !== "string" || !data.name) patch.name = spec.name;
    if (typeof data.description !== "string") patch.description = spec.description;
    if (spec.id === KEYMASTER_ROLE_ID) {
      patch.permissions = WILDCARD;
    } else if (!Array.isArray(data.permissions) && data.permissions !== WILDCARD) {
      patch.permissions = spec.permissions;
    }

    await ref.set(patch, { merge: true });
    console.log(`  ~ refreshed ${spec.id}`);
    updated++;
  }

  console.log(`Roles: ${created} created, ${updated} refreshed.\n`);
}

async function assignKeymaster(
  db: Firestore,
  auth: ReturnType<typeof getAuth>,
  email: string,
): Promise<void> {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (err) {
    console.warn(
      `Keymaster user (${email}) not found in Firebase Auth. Skipping assignment — sign in once at /admin, then re-run this script.`,
      err instanceof Error ? `(${err.message})` : "",
    );
    return;
  }

  const targetUid = user.uid;
  const userRef = db.collection(USERS_COLLECTION).doc(targetUid);

  // Demote any other user currently holding keymaster.
  const otherKeymasters = await db
    .collection(USERS_COLLECTION)
    .where("role", "==", KEYMASTER_ROLE_ID)
    .get();
  const demoted: string[] = [];
  const batch = db.batch();
  for (const doc of otherKeymasters.docs) {
    if (doc.id === targetUid) continue;
    batch.set(
      doc.ref,
      { role: "admin", updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    demoted.push(doc.id);
  }
  if (demoted.length > 0) {
    await batch.commit();
    console.warn(
      `Demoted ${demoted.length} other keymaster(s) to admin: ${demoted.join(", ")}`,
    );
  }

  // Upsert the keymaster on the target user.
  await userRef.set(
    {
      role: KEYMASTER_ROLE_ID,
      email,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`Keymaster role assigned to ${email} (uid: ${targetUid}).`);
}

async function main() {
  const { db, auth } = init();
  const email = (process.env.KEYMASTER_EMAIL || DEFAULT_KEYMASTER_EMAIL).toLowerCase();

  console.log("Seeding built-in roles...");
  await seedRoles(db);

  console.log(`Assigning Keymaster to ${email}...`);
  await assignKeymaster(db, auth, email);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
