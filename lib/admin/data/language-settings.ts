import "server-only";
import { cache } from "react";
import { Timestamp } from "firebase-admin/firestore";
import { getDb, requireDb } from "@/lib/firebase/admin";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { ALL_LANGS, type LangCode } from "@/lib/translations";

export const LANGUAGE_SETTINGS_COLLECTION = "config";
export const LANGUAGE_SETTINGS_DOC = "languages";

const CONTENT_DEFAULT: LangCode = "ar";

export type LanguageSettings = {
  uiEnabled: Locale[];
  contentEnabled: LangCode[];
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
    contentEnabled: [...ALL_LANGS],
  };
}

export const getLanguageSettings = cache(async (): Promise<LanguageSettings> => {
  const db = getDb();
  if (!db) return defaults();
  try {
    const snap = await db
      .collection(LANGUAGE_SETTINGS_COLLECTION)
      .doc(LANGUAGE_SETTINGS_DOC)
      .get();
    if (!snap.exists) return defaults();
    const data = snap.data() ?? {};
    return {
      uiEnabled: sanitizeUi(data.uiEnabled),
      contentEnabled: sanitizeContent(data.contentEnabled),
    };
  } catch (err) {
    console.warn("[admin/data/language-settings] read failed:", err);
    return defaults();
  }
});

export type SetLanguageSettingsInput = {
  uiEnabled: readonly string[];
  contentEnabled: readonly string[];
};

export async function setLanguageSettings(
  input: SetLanguageSettingsInput,
  adminEmail: string,
): Promise<LanguageSettings> {
  const db = requireDb();
  const next: LanguageSettings = {
    uiEnabled: sanitizeUi(input.uiEnabled),
    contentEnabled: sanitizeContent(input.contentEnabled),
  };
  await db
    .collection(LANGUAGE_SETTINGS_COLLECTION)
    .doc(LANGUAGE_SETTINGS_DOC)
    .set(
      {
        uiEnabled: next.uiEnabled,
        contentEnabled: next.contentEnabled,
        updatedAt: Timestamp.now(),
        updatedBy: adminEmail,
      },
      { merge: true },
    );
  return next;
}
