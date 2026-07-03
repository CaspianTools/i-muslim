import "server-only";
import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { getDb, requireDb } from "@/lib/firebase/admin";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { ALL_LANGS, type LangCode } from "@/lib/translations";

export const LANGUAGE_SETTINGS_COLLECTION = "config";
export const LANGUAGE_SETTINGS_DOC = "languages";

const CONTENT_DEFAULT: LangCode = "ar";

export type LanguageSettings = {
  uiEnabled: Locale[];
  // Translation languages enabled for /quran/* — independent of Hadith so
  // an admin can ship a Qur'an translation before hadith data is seeded.
  quranEnabled: LangCode[];
  hadithEnabled: LangCode[];
};

function uniqInOrder<T extends string>(values: T[], ordering: readonly T[]): T[] {
  const set = new Set(values);
  return ordering.filter((v) => set.has(v));
}

function sanitizeUi(raw: unknown): Locale[] {
  const list = Array.isArray(raw) ? raw : [];
  const valid = list.filter((v): v is Locale =>
    typeof v === "string" && (LOCALES as readonly string[]).includes(v),
  );
  // Always include the default locale; preserve canonical ordering.
  return uniqInOrder([DEFAULT_LOCALE, ...valid], LOCALES);
}

function sanitizeContent(raw: unknown): LangCode[] {
  const list = Array.isArray(raw) ? raw : [];
  const valid = list.filter((v): v is LangCode =>
    typeof v === "string" && (ALL_LANGS as readonly string[]).includes(v),
  );
  // Arabic is the original sacred-text language and must always remain enabled.
  return uniqInOrder([CONTENT_DEFAULT, ...valid], ALL_LANGS);
}

function defaults(): LanguageSettings {
  return {
    uiEnabled: [...LOCALES],
    quranEnabled: [...ALL_LANGS],
    hadithEnabled: [...ALL_LANGS],
  };
}

async function readLanguageSettings(): Promise<LanguageSettings> {
  const db = getDb();
  if (!db) return defaults();
  try {
    const snap = await db
      .collection(LANGUAGE_SETTINGS_COLLECTION)
      .doc(LANGUAGE_SETTINGS_DOC)
      .get();
    if (!snap.exists) return defaults();
    const data = snap.data() ?? {};
    // Backwards compat: docs written before the Quran/Hadith split only have
    // a single `contentEnabled` field. Use it for both new fields on first
    // load; the next save persists the split.
    const legacyContent = data.contentEnabled;
    const quranRaw = data.quranEnabled ?? legacyContent;
    const hadithRaw = data.hadithEnabled ?? legacyContent;
    return {
      uiEnabled: sanitizeUi(data.uiEnabled),
      quranEnabled: sanitizeContent(quranRaw),
      hadithEnabled: sanitizeContent(hadithRaw),
    };
  } catch (err) {
    console.warn("[admin/data/language-settings] read failed:", err);
    return defaults();
  }
}

// The Footer + Quran/Hadith pages read `config/languages` on every request, but
// it only changes on admin edits. Cache in the Data Cache (invalidated on write
// via `revalidateLanguageSettings`) with a TTL fallback, plus React `cache` for
// per-render dedupe.
export const LANGUAGE_SETTINGS_TAG = "config:languages";

const cachedReadLanguageSettings = unstable_cache(
  readLanguageSettings,
  ["admin:language-settings"],
  { revalidate: 60 * 60, tags: [LANGUAGE_SETTINGS_TAG] },
);

export const getLanguageSettings = cache(cachedReadLanguageSettings);

// Call from admin write actions after mutating `config/languages`.
export function revalidateLanguageSettings(): void {
  revalidateTag(LANGUAGE_SETTINGS_TAG, { expire: 0 });
}

export type SetLanguageSettingsInput = {
  uiEnabled: readonly string[];
  quranEnabled: readonly string[];
  hadithEnabled: readonly string[];
};

export async function setLanguageSettings(
  input: SetLanguageSettingsInput,
  adminEmail: string,
): Promise<LanguageSettings> {
  const db = requireDb();
  const next: LanguageSettings = {
    uiEnabled: sanitizeUi(input.uiEnabled),
    quranEnabled: sanitizeContent(input.quranEnabled),
    hadithEnabled: sanitizeContent(input.hadithEnabled),
  };
  await db
    .collection(LANGUAGE_SETTINGS_COLLECTION)
    .doc(LANGUAGE_SETTINGS_DOC)
    .set(
      {
        uiEnabled: next.uiEnabled,
        quranEnabled: next.quranEnabled,
        hadithEnabled: next.hadithEnabled,
        updatedAt: Timestamp.now(),
        updatedBy: adminEmail,
      },
      { merge: true },
    );
  return next;
}
