import "server-only";
import { cache } from "react";
import { Timestamp } from "firebase-admin/firestore";
import { getDb, requireDb } from "@/lib/firebase/admin";
import {
  LOCALES,
  RESERVED_LOCALES,
  BUNDLED_LOCALES,
  LOCALE_META,
  type Locale,
} from "@/i18n/config";

export const UI_LOCALES_COLLECTION = "config";
// Subcollection keyed by locale code. We store one doc per reserved locale at
// `config/uiLocales/locales/{code}` to keep the simple `config/languages` doc
// (used by the existing toggle settings) at the same depth.
export const UI_LOCALES_SUBPATH = "uiLocales/locales";

export type UiLocaleDoc = {
  code: Locale;
  activated: boolean;
  nativeName: string;
  englishName: string;
  flag: string;
  rtl: boolean;
  baseLocale: Locale;
  // Free-form translations object — deep-merged over the base locale at
  // request time, so partial uploads are fine.
  messages: Record<string, unknown>;
  activatedAt: string | null;
  activatedBy: string | null;
};

function defaultMeta(code: Locale): UiLocaleDoc {
  const meta = LOCALE_META[code];
  return {
    code,
    activated: false,
    nativeName: meta?.nativeName ?? code,
    englishName: meta?.englishName ?? code,
    flag: meta?.flag ?? "🌐",
    rtl: false,
    baseLocale: "en",
    messages: {},
    activatedAt: null,
    activatedBy: null,
  };
}

function asIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (
    typeof v === "object" &&
    v &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  return null;
}

function normalize(code: Locale, raw: Record<string, unknown> | undefined): UiLocaleDoc {
  if (!raw) return defaultMeta(code);
  const meta = LOCALE_META[code];
  return {
    code,
    activated: raw.activated === true,
    nativeName: typeof raw.nativeName === "string" && raw.nativeName.length > 0
      ? raw.nativeName
      : meta?.nativeName ?? code,
    englishName: typeof raw.englishName === "string" && raw.englishName.length > 0
      ? raw.englishName
      : meta?.englishName ?? code,
    flag: typeof raw.flag === "string" && raw.flag.length > 0 ? raw.flag : meta?.flag ?? "🌐",
    rtl: raw.rtl === true,
    baseLocale: typeof raw.baseLocale === "string" ? (raw.baseLocale as Locale) : "en",
    messages:
      raw.messages && typeof raw.messages === "object"
        ? (raw.messages as Record<string, unknown>)
        : {},
    activatedAt: asIso(raw.activatedAt),
    activatedBy: typeof raw.activatedBy === "string" ? raw.activatedBy : null,
  };
}

function isReservedLocale(code: string): code is Locale {
  return (RESERVED_LOCALES as readonly string[]).includes(code);
}

function isKnownLocale(code: string): code is Locale {
  return (LOCALES as readonly string[]).includes(code);
}

export const listReservedLocaleDocs = cache(async (): Promise<UiLocaleDoc[]> => {
  const db = getDb();
  if (!db) return RESERVED_LOCALES.map((c) => defaultMeta(c));
  try {
    const snap = await db
      .collection(UI_LOCALES_COLLECTION)
      .doc("uiLocales")
      .collection("locales")
      .get();
    const byCode = new Map<string, UiLocaleDoc>();
    for (const d of snap.docs) {
      if (!isReservedLocale(d.id)) continue;
      byCode.set(d.id, normalize(d.id, d.data() as Record<string, unknown>));
    }
    return RESERVED_LOCALES.map((c) => byCode.get(c) ?? defaultMeta(c));
  } catch (err) {
    console.warn("[admin/data/ui-locales] list failed:", err);
    return RESERVED_LOCALES.map((c) => defaultMeta(c));
  }
});

export const listActivatedReservedLocales = cache(async (): Promise<Locale[]> => {
  const docs = await listReservedLocaleDocs();
  return docs.filter((d) => d.activated).map((d) => d.code);
});

// Returns the per-locale doc for every code in `LOCALES` — bundled and reserved.
// Bundled locales never have an "activation" lifecycle (they always render),
// so their `activated` field defaults to `true`. Reserved locales without a
// Firestore doc default to `activated: false`. Both can carry an optional
// `messages` overlay an admin/translator has saved through the phrase editor.
export const listAllUiLocaleDocs = cache(async (): Promise<UiLocaleDoc[]> => {
  const db = getDb();
  const seedFor = (c: Locale): UiLocaleDoc =>
    (BUNDLED_LOCALES as readonly string[]).includes(c)
      ? { ...defaultMeta(c), activated: true }
      : defaultMeta(c);
  if (!db) return LOCALES.map(seedFor);
  try {
    const snap = await db
      .collection(UI_LOCALES_COLLECTION)
      .doc("uiLocales")
      .collection("locales")
      .get();
    const byCode = new Map<string, UiLocaleDoc>();
    for (const d of snap.docs) {
      if (!isKnownLocale(d.id)) continue;
      const normalized = normalize(d.id, d.data() as Record<string, unknown>);
      // Bundled locales are always usable regardless of what's in the doc —
      // a stale `activated: false` from manual Firestore tinkering shouldn't
      // hide them. Reserved locales honour the doc value.
      byCode.set(
        d.id,
        (BUNDLED_LOCALES as readonly string[]).includes(d.id)
          ? { ...normalized, activated: true }
          : normalized,
      );
    }
    return LOCALES.map((c) => byCode.get(c) ?? seedFor(c));
  } catch (err) {
    console.warn("[admin/data/ui-locales] listAll failed:", err);
    return LOCALES.map(seedFor);
  }
});

export const getUiLocaleDoc = cache(
  async (code: Locale): Promise<UiLocaleDoc | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const snap = await db
        .collection(UI_LOCALES_COLLECTION)
        .doc("uiLocales")
        .collection("locales")
        .doc(code)
        .get();
      if (!snap.exists) return null;
      return normalize(code, snap.data() as Record<string, unknown>);
    } catch (err) {
      console.warn(`[admin/data/ui-locales] get(${code}) failed:`, err);
      return null;
    }
  },
);

export type ActivateUiLocaleInput = {
  code: Locale;
  nativeName: string;
  englishName: string;
  flag: string;
  rtl: boolean;
  baseLocale: Locale;
  messages: Record<string, unknown>;
};

export async function setUiLocale(
  input: ActivateUiLocaleInput,
  adminEmail: string,
): Promise<UiLocaleDoc> {
  const db = requireDb();
  const docData = {
    code: input.code,
    activated: true,
    nativeName: input.nativeName,
    englishName: input.englishName,
    flag: input.flag,
    rtl: input.rtl,
    baseLocale: input.baseLocale,
    messages: input.messages,
    activatedAt: Timestamp.now(),
    activatedBy: adminEmail,
  };
  await db
    .collection(UI_LOCALES_COLLECTION)
    .doc("uiLocales")
    .collection("locales")
    .doc(input.code)
    .set(docData, { merge: true });
  return normalize(input.code, docData);
}

// Update only the `messages` field of an already-activated locale doc.
// Used by the phrase-by-phrase editor — leaves nativeName/flag/etc. alone.
export async function updateUiLocaleMessages(
  code: Locale,
  messages: Record<string, unknown>,
  adminEmail: string,
): Promise<UiLocaleDoc> {
  const db = requireDb();
  await db
    .collection(UI_LOCALES_COLLECTION)
    .doc("uiLocales")
    .collection("locales")
    .doc(code)
    .set(
      {
        messages,
        updatedAt: Timestamp.now(),
        updatedBy: adminEmail,
      },
      { merge: true },
    );
  // Re-read to return the canonical normalized doc.
  const snap = await db
    .collection(UI_LOCALES_COLLECTION)
    .doc("uiLocales")
    .collection("locales")
    .doc(code)
    .get();
  return normalize(code, snap.data() as Record<string, unknown>);
}

export async function deactivateUiLocale(
  code: Locale,
  adminEmail: string,
): Promise<void> {
  const db = requireDb();
  await db
    .collection(UI_LOCALES_COLLECTION)
    .doc("uiLocales")
    .collection("locales")
    .doc(code)
    .set(
      {
        activated: false,
        deactivatedAt: Timestamp.now(),
        deactivatedBy: adminEmail,
      },
      { merge: true },
    );
}
