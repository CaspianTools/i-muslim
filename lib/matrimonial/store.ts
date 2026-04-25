import "server-only";
import { getDb } from "@/lib/firebase/admin";
import {
  MOCK_INTERESTS,
  MOCK_PROFILES,
  MOCK_REPORTS,
} from "@/lib/admin/mock/matrimonial";
import type {
  MatrimonialInterest,
  MatrimonialProfile,
  MatrimonialReport,
} from "@/types/matrimonial";

export type StoreSource = "firestore" | "mock";

const PROFILES_COLLECTION = "matrimonialProfiles";
const INTERESTS_COLLECTION = "matrimonialInterests";
const REPORTS_COLLECTION = "matrimonialReports";

type MockState = {
  profiles: Map<string, MatrimonialProfile>;
  interests: Map<string, MatrimonialInterest>;
  reports: Map<string, MatrimonialReport>;
};

const globalAny = globalThis as unknown as { __matrimonialMock?: MockState };

function getMockState(): MockState {
  if (!globalAny.__matrimonialMock) {
    globalAny.__matrimonialMock = {
      profiles: new Map(MOCK_PROFILES.map((p) => [p.id, structuredClone(p)])),
      interests: new Map(MOCK_INTERESTS.map((i) => [i.id, structuredClone(i)])),
      reports: new Map(MOCK_REPORTS.map((r) => [r.id, structuredClone(r)])),
    };
  }
  return globalAny.__matrimonialMock;
}

function isoFrom(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (
    typeof v === "object" &&
    v !== null &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  return new Date().toISOString();
}

function normalizeProfile(id: string, raw: Record<string, unknown>): MatrimonialProfile | null {
  if (!raw) return null;
  return {
    id,
    userId: (raw.userId as string) ?? id,
    displayName: (raw.displayName as string) ?? "Unknown",
    gender: (raw.gender as MatrimonialProfile["gender"]) ?? "male",
    dateOfBirth: isoFrom(raw.dateOfBirth),
    country: (raw.country as string) ?? "",
    city: (raw.city as string) ?? "",
    ethnicity: (raw.ethnicity as string | null) ?? null,
    languages: Array.isArray(raw.languages) ? (raw.languages as string[]) : [],

    madhhab: (raw.madhhab as MatrimonialProfile["madhhab"]) ?? "none",
    sect: (raw.sect as MatrimonialProfile["sect"]) ?? "sunni",
    prayerCommitment: (raw.prayerCommitment as MatrimonialProfile["prayerCommitment"]) ?? "sometimes",
    hijab: (raw.hijab as MatrimonialProfile["hijab"]) ?? "na",
    beard: (raw.beard as MatrimonialProfile["beard"]) ?? "na",
    revert: Boolean(raw.revert),
    polygamyStance: (raw.polygamyStance as MatrimonialProfile["polygamyStance"]) ?? "na",
    maritalHistory: (raw.maritalHistory as MatrimonialProfile["maritalHistory"]) ?? "never_married",
    hasChildren: Boolean(raw.hasChildren),
    wantsChildren: (raw.wantsChildren as MatrimonialProfile["wantsChildren"]) ?? "maybe",

    education: (raw.education as MatrimonialProfile["education"]) ?? "other",
    profession: (raw.profession as string | null) ?? null,

    preferences: (raw.preferences as MatrimonialProfile["preferences"]) ?? {
      lookingForGender: "female",
      ageMin: 18,
      ageMax: 60,
      countries: [],
      locationRadiusKm: null,
      madhhabs: [],
      sects: [],
      prayerMin: "sometimes",
      polygamyAcceptable: true,
    },

    bio: (raw.bio as string) ?? "",
    photos: (raw.photos as MatrimonialProfile["photos"]) ?? [],

    status: (raw.status as MatrimonialProfile["status"]) ?? "draft",
    verification: (raw.verification as MatrimonialProfile["verification"]) ?? {
      emailVerified: false,
      phoneVerified: false,
      photoVerified: false,
      idVerified: false,
    },

    subscription: (raw.subscription as MatrimonialProfile["subscription"]) ?? {
      tier: "free",
      expiresAt: null,
    },
    rateLimit: (raw.rateLimit as MatrimonialProfile["rateLimit"]) ?? {
      dailyInterestsUsed: 0,
      dailyInterestsResetAt: new Date().toISOString(),
    },

    createdAt: isoFrom(raw.createdAt),
    updatedAt: isoFrom(raw.updatedAt),
    lastActiveAt: isoFrom(raw.lastActiveAt ?? raw.updatedAt ?? raw.createdAt),
  };
}

function normalizeInterest(id: string, raw: Record<string, unknown>): MatrimonialInterest {
  return {
    id,
    fromUserId: (raw.fromUserId as string) ?? "",
    toUserId: (raw.toUserId as string) ?? "",
    status: (raw.status as MatrimonialInterest["status"]) ?? "pending",
    message: (raw.message as string | null) ?? null,
    createdAt: isoFrom(raw.createdAt),
    respondedAt: raw.respondedAt ? isoFrom(raw.respondedAt) : null,
  };
}

function normalizeReport(id: string, raw: Record<string, unknown>): MatrimonialReport {
  return {
    id,
    reporterUserId: (raw.reporterUserId as string) ?? "",
    targetUserId: (raw.targetUserId as string) ?? "",
    reason: (raw.reason as MatrimonialReport["reason"]) ?? "other",
    notes: (raw.notes as string | null) ?? null,
    status: (raw.status as MatrimonialReport["status"]) ?? "open",
    createdAt: isoFrom(raw.createdAt),
    resolvedAt: raw.resolvedAt ? isoFrom(raw.resolvedAt) : null,
    resolvedBy: (raw.resolvedBy as string | null) ?? null,
  };
}

export async function getStoreSource(): Promise<StoreSource> {
  return getDb() ? "firestore" : "mock";
}

export async function listProfiles(): Promise<{
  profiles: MatrimonialProfile[];
  source: StoreSource;
}> {
  const db = getDb();
  if (!db) {
    return { profiles: Array.from(getMockState().profiles.values()), source: "mock" };
  }
  try {
    const snap = await db.collection(PROFILES_COLLECTION).limit(500).get();
    const profiles = snap.docs
      .map((d) => normalizeProfile(d.id, d.data() as Record<string, unknown>))
      .filter((p): p is MatrimonialProfile => p !== null);
    if (profiles.length === 0) {
      return { profiles: Array.from(getMockState().profiles.values()), source: "mock" };
    }
    return { profiles, source: "firestore" };
  } catch (err) {
    console.warn("[matrimonial/store] listProfiles fallback:", err);
    return { profiles: Array.from(getMockState().profiles.values()), source: "mock" };
  }
}

export async function getProfile(id: string): Promise<MatrimonialProfile | null> {
  const db = getDb();
  if (!db) {
    return getMockState().profiles.get(id) ?? null;
  }
  try {
    const doc = await db.collection(PROFILES_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return normalizeProfile(doc.id, doc.data() as Record<string, unknown>);
  } catch (err) {
    console.warn("[matrimonial/store] getProfile fallback:", err);
    return getMockState().profiles.get(id) ?? null;
  }
}

export async function upsertProfile(profile: MatrimonialProfile): Promise<void> {
  const db = getDb();
  if (!db) {
    getMockState().profiles.set(profile.id, structuredClone(profile));
    return;
  }
  await db.collection(PROFILES_COLLECTION).doc(profile.id).set(profile, { merge: true });
}

export async function patchProfile(
  id: string,
  patch: Partial<MatrimonialProfile>,
): Promise<MatrimonialProfile | null> {
  const current = await getProfile(id);
  if (!current) return null;
  const next: MatrimonialProfile = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await upsertProfile(next);
  return next;
}

export async function deleteProfileById(id: string): Promise<void> {
  const db = getDb();
  if (!db) {
    getMockState().profiles.delete(id);
    return;
  }
  await db.collection(PROFILES_COLLECTION).doc(id).delete();
}

export async function listInterests(): Promise<MatrimonialInterest[]> {
  const db = getDb();
  if (!db) {
    return Array.from(getMockState().interests.values());
  }
  try {
    const snap = await db.collection(INTERESTS_COLLECTION).limit(500).get();
    return snap.docs.map((d) => normalizeInterest(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    console.warn("[matrimonial/store] listInterests fallback:", err);
    return Array.from(getMockState().interests.values());
  }
}

export async function listInterestsForUser(userId: string): Promise<{
  incoming: MatrimonialInterest[];
  outgoing: MatrimonialInterest[];
}> {
  const all = await listInterests();
  return {
    incoming: all.filter((i) => i.toUserId === userId),
    outgoing: all.filter((i) => i.fromUserId === userId),
  };
}

export async function findInterest(
  fromUserId: string,
  toUserId: string,
): Promise<MatrimonialInterest | null> {
  const all = await listInterests();
  return (
    all.find((i) => i.fromUserId === fromUserId && i.toUserId === toUserId) ?? null
  );
}

export async function upsertInterest(interest: MatrimonialInterest): Promise<void> {
  const db = getDb();
  if (!db) {
    getMockState().interests.set(interest.id, structuredClone(interest));
    return;
  }
  await db.collection(INTERESTS_COLLECTION).doc(interest.id).set(interest, { merge: true });
}

export async function listReports(): Promise<MatrimonialReport[]> {
  const db = getDb();
  if (!db) {
    return Array.from(getMockState().reports.values());
  }
  try {
    const snap = await db.collection(REPORTS_COLLECTION).limit(500).get();
    return snap.docs.map((d) => normalizeReport(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    console.warn("[matrimonial/store] listReports fallback:", err);
    return Array.from(getMockState().reports.values());
  }
}

export async function upsertReport(report: MatrimonialReport): Promise<void> {
  const db = getDb();
  if (!db) {
    getMockState().reports.set(report.id, structuredClone(report));
    return;
  }
  await db.collection(REPORTS_COLLECTION).doc(report.id).set(report, { merge: true });
}

export async function isMatched(userIdA: string, userIdB: string): Promise<boolean> {
  if (userIdA === userIdB) return false;
  const a = await findInterest(userIdA, userIdB);
  if (a?.status !== "accepted") return false;
  const b = await findInterest(userIdB, userIdA);
  return b?.status === "accepted";
}

export async function listMatchesFor(userId: string): Promise<MatrimonialProfile[]> {
  const interests = await listInterests();
  const accepted = interests.filter((i) => i.status === "accepted");
  const partners = new Set<string>();
  for (const a of accepted) {
    const counterpart = a.fromUserId === userId ? a.toUserId : a.toUserId === userId ? a.fromUserId : null;
    if (!counterpart) continue;
    const reverse = accepted.find(
      (b) => b.fromUserId === counterpart && b.toUserId === userId,
    );
    if (reverse) partners.add(counterpart);
  }
  const profiles = await Promise.all(Array.from(partners).map((id) => getProfile(id)));
  return profiles.filter((p): p is MatrimonialProfile => p !== null);
}
