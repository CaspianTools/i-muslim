import type {
  Gender,
  Madhhab,
  MaritalHistory,
  MatrimonialInterest,
  MatrimonialProfile,
  MatrimonialReport,
  PrayerCommitment,
  ProfileStatus,
  ReportReason,
} from "@/types/matrimonial";
import { nextMidnightUtc } from "@/lib/matrimonial/rate-limit";

const FEMALE_NAMES = [
  "Aisha Rahman", "Fatima Ahmed", "Mariam Hassan", "Zainab Iqbal",
  "Layla Nasser", "Safiya Chaudhry", "Amina Toure", "Noor Al-Harbi",
  "Hadiya Rashid", "Khadija Nour", "Rania Farouk", "Nadia Khoury",
  "Sumaya Ibrahim", "Hafsa Mirza", "Zahra Mahmoud", "Salma Bouazizi",
  "Rabia Khalil", "Hana Abdi", "Yasmin Qureshi", "Malak Badr",
  "Isra Malik", "Nur Aisyah Binti", "Sofia Benali", "Widad Saleh",
  "Zeynep Arslan",
];

const MALE_NAMES = [
  "Yusuf Khan", "Ibrahim Abdullah", "Omar Siddiqui", "Khalid Anwar",
  "Bilal Karim", "Hamza Syed", "Mustafa Yilmaz", "Abdul-Rahman Ali",
  "Tariq Patel", "Ismail Suleiman", "Saif Ahmad", "Jibril Musa",
  "Kareem Osman", "Rashid Aziz", "Imran Sheikh", "Fahim Raza",
  "Saeed Bashir", "Adam Thompson", "Fatih Kaya", "Emir Demir",
  "Mehmet Ozdemir", "Ridwan Hakim", "Umar Faruq", "Yahya Diop",
  "Mohammed Al-Amin",
];

const COUNTRIES = ["GB", "US", "TR", "ID"] as const;
const CITIES: Record<(typeof COUNTRIES)[number], string[]> = {
  GB: ["London", "Birmingham", "Manchester"],
  US: ["New York", "Chicago", "Dallas"],
  TR: ["Istanbul", "Ankara", "Izmir"],
  ID: ["Jakarta", "Bandung", "Surabaya"],
};
const ETHNICITIES = ["Arab", "South Asian", "Turkish", "Indonesian", "African", "European Convert"];
const LANGUAGES = ["en", "ar", "tr", "id", "ur"];
const MADHHABS: Madhhab[] = ["hanafi", "maliki", "shafii", "hanbali", "none"];
const PRAYER: PrayerCommitment[] = ["always", "mostly", "sometimes", "learning"];
const STATUSES: ProfileStatus[] = ["active", "active", "active", "active", "pending", "suspended", "hidden"];
const MARITAL: MaritalHistory[] = ["never_married", "never_married", "divorced", "widowed"];
const EDUCATION = ["high_school", "diploma", "bachelor", "bachelor", "master", "phd"] as const;
const PROFESSIONS = ["Software Engineer", "Teacher", "Doctor", "Imam", "Designer", "Accountant", "Nurse", "Researcher"];
const REASONS: ReportReason[] = ["fake", "harassment", "inappropriate_photo", "non_muslim", "scam", "other"];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function pickN<T>(rand: () => number, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]!);
  }
  return out;
}

function dobForAge(age: number, rand: () => number): string {
  const now = new Date();
  const d = new Date(
    now.getFullYear() - age,
    Math.floor(rand() * 12),
    1 + Math.floor(rand() * 27),
  );
  return d.toISOString();
}

function buildProfile(
  index: number,
  name: string,
  gender: Gender,
  rand: () => number,
): MatrimonialProfile {
  const id = `mp_${gender[0]}_${index.toString().padStart(3, "0")}`;
  const country = pick(rand, COUNTRIES);
  const city = pick(rand, CITIES[country]);
  const age = 21 + Math.floor(rand() * 18);
  const status = STATUSES[Math.floor(rand() * STATUSES.length)]!;
  const verified = rand() > 0.3;
  const photoVerified = verified && rand() > 0.5;
  const lookingFor: Gender = gender === "male" ? "female" : "male";
  const madhhab = pick(rand, MADHHABS);
  const prayer = pick(rand, PRAYER);
  const joinedDaysAgo = Math.floor(rand() * 360);
  const now = Date.now();
  const photos = Array.from({ length: 1 + Math.floor(rand() * 3) }, (_, i) => ({
    id: `${id}_p${i}`,
    url: `https://i.pravatar.cc/300?img=${(index * 3 + i) % 70 + 1}`,
    visibility: "match_only" as const,
    uploadedAt: new Date(now - i * 86_400_000).toISOString(),
  }));

  return {
    id,
    userId: id,
    displayName: name,
    gender,
    dateOfBirth: dobForAge(age, rand),
    country,
    city,
    ethnicity: pick(rand, ETHNICITIES),
    languages: pickN(rand, LANGUAGES, 1 + Math.floor(rand() * 2)),

    madhhab,
    sect: rand() > 0.92 ? "shia" : "sunni",
    prayerCommitment: prayer,
    hijab: gender === "female" ? pick(rand, ["khimar", "shayla", "niqab", "none"] as const) : "na",
    beard: gender === "male" ? pick(rand, ["full", "trimmed", "none"] as const) : "na",
    revert: rand() > 0.85,
    polygamyStance: gender === "male" ? pick(rand, ["open", "neutral", "closed"] as const) : pick(rand, ["closed", "neutral"] as const),
    maritalHistory: pick(rand, MARITAL),
    hasChildren: rand() > 0.85,
    wantsChildren: pick(rand, ["yes", "yes", "yes", "maybe", "no"] as const),

    education: pick(rand, EDUCATION),
    profession: pick(rand, PROFESSIONS),

    preferences: {
      lookingForGender: lookingFor,
      ageMin: Math.max(18, age - 6),
      ageMax: age + 8,
      countries: rand() > 0.5 ? [country] : [],
      locationRadiusKm: null,
      madhhabs: rand() > 0.6 ? [madhhab] : [],
      sects: [],
      prayerMin: rand() > 0.5 ? "mostly" : "sometimes",
      polygamyAcceptable: gender === "female" ? rand() > 0.85 : true,
    },

    bio: `Practicing Muslim from ${city}, looking for a spouse who values deen and family.`,
    photos,

    status,
    verification: {
      emailVerified: verified,
      phoneVerified: verified && rand() > 0.6,
      photoVerified,
      idVerified: photoVerified && rand() > 0.7,
    },

    subscription: { tier: "free", expiresAt: null },
    rateLimit: {
      dailyInterestsUsed: Math.floor(rand() * 3),
      dailyInterestsResetAt: nextMidnightUtc(),
    },

    createdAt: new Date(now - joinedDaysAgo * 86_400_000).toISOString(),
    updatedAt: new Date(now - Math.floor(rand() * 7) * 86_400_000).toISOString(),
    lastActiveAt: new Date(now - Math.floor(rand() * 24) * 3_600_000).toISOString(),
  };
}

export function buildMockProfiles(): MatrimonialProfile[] {
  const rand = seededRandom(2_604_2026);
  const female = FEMALE_NAMES.map((n, i) => buildProfile(i, n, "female", rand));
  const male = MALE_NAMES.map((n, i) => buildProfile(i, n, "male", rand));
  return [...female, ...male];
}

export const MOCK_PROFILES: MatrimonialProfile[] = buildMockProfiles();

export function buildMockInterests(profiles: MatrimonialProfile[]): MatrimonialInterest[] {
  const out: MatrimonialInterest[] = [];
  const males = profiles.filter((p) => p.gender === "male" && p.status === "active");
  const females = profiles.filter((p) => p.gender === "female" && p.status === "active");
  const now = Date.now();
  let idx = 0;

  function pushInterest(
    from: MatrimonialProfile,
    to: MatrimonialProfile,
    status: MatrimonialInterest["status"],
    daysAgo: number,
  ) {
    out.push({
      id: `mi_${idx.toString().padStart(4, "0")}`,
      fromUserId: from.id,
      toUserId: to.id,
      status,
      message: status === "pending" ? "Assalamu alaikum, I'd like to learn more." : null,
      createdAt: new Date(now - daysAgo * 86_400_000).toISOString(),
      respondedAt: status === "pending" ? null : new Date(now - (daysAgo - 1) * 86_400_000).toISOString(),
    });
    idx++;
  }

  for (let i = 0; i < 10 && i < males.length && i < females.length; i++) {
    pushInterest(males[i]!, females[i]!, "pending", 1 + i);
  }
  for (let i = 0; i < 5 && i + 10 < males.length && i + 10 < females.length; i++) {
    pushInterest(males[i + 10]!, females[i + 10]!, "accepted", 5 + i);
    pushInterest(females[i + 10]!, males[i + 10]!, "accepted", 5 + i);
  }
  for (let i = 0; i < 10 && i + 15 < males.length && i + 15 < females.length; i++) {
    pushInterest(males[i + 15]!, females[i + 15]!, "declined", 8 + i);
  }
  return out;
}

export const MOCK_INTERESTS: MatrimonialInterest[] = buildMockInterests(MOCK_PROFILES);

export function buildMockReports(profiles: MatrimonialProfile[]): MatrimonialReport[] {
  if (profiles.length < 10) return [];
  const rand = seededRandom(99);
  const now = Date.now();
  return Array.from({ length: 5 }, (_, i) => {
    const reporter = profiles[Math.floor(rand() * profiles.length)]!;
    let target = profiles[Math.floor(rand() * profiles.length)]!;
    if (target.id === reporter.id) target = profiles[(profiles.indexOf(reporter) + 1) % profiles.length]!;
    return {
      id: `mr_${i.toString().padStart(3, "0")}`,
      reporterUserId: reporter.id,
      targetUserId: target.id,
      reason: pick(rand, REASONS),
      notes: i % 2 === 0 ? "Profile photos appear stolen from social media." : null,
      status: i < 3 ? "open" : i === 3 ? "resolved" : "dismissed",
      createdAt: new Date(now - i * 2 * 86_400_000).toISOString(),
      resolvedAt: i >= 3 ? new Date(now - i * 86_400_000).toISOString() : null,
      resolvedBy: i >= 3 ? "admin" : null,
    };
  });
}

export const MOCK_REPORTS: MatrimonialReport[] = buildMockReports(MOCK_PROFILES);
