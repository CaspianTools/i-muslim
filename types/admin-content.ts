// Shared types used by both server (admin data fetchers, API routes) and
// client (edit drawers) code. Kept free of "server-only" so they can be
// imported from "use client" components without breaking the build.

export type AdminSurah = {
  number: number;
  name_ar: string;
  name_en: string;
  name_translated: string;
  revelation_place: "makkah" | "madinah";
  ayah_count: number;
  bismillah_pre: boolean;
  edited_count?: number;
};

export type AdminAyah = {
  id: string; // "{surah}:{ayah}"
  surah: number;
  ayah: number;
  text_ar: string;
  text_translit: string | null;
  // Keyed by LangCode (en/ru/az/tr/...). Missing keys mean "no translation
  // yet" — the public reader and admin filter handle absence gracefully.
  translations: Record<string, string>;
  // editedTranslations.<lang> === true marks an admin override that the
  // per-language seeder (scripts/seed-quran-translation.ts) preserves on
  // re-runs. Mirrors AdminHadith.
  editedTranslations: Record<string, boolean>;
  juz: number;
  page: number;
  sajdah: boolean;
  tags: string[];
  notes: string | null;
  published: boolean;
  editedByAdmin: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type AdminHadithCollection = {
  slug: string;
  name_en: string;
  name_ar: string;
  short_name?: string;
  total: number;
  books: Array<{ number: number; name: string; count: number }>;
  edited_count?: number;
};

export type AdminHadith = {
  id: string; // "{collection}:{number}"
  collection: string;
  number: number;
  arabic_number: number | null;
  book: number;
  hadith_in_book: number | null;
  text_ar: string;
  // Keyed by LangCode (en/ru/az/tr/...). Missing keys mean "no translation
  // yet" — render fallbacks decide what to do.
  translations: Record<string, string>;
  // editedTranslations.<lang> === true marks an admin override that the
  // per-language seeders preserve on re-runs.
  editedTranslations: Record<string, boolean>;
  narrator: string | null;
  grade: string | null;
  tags: string[];
  notes: string | null;
  published: boolean;
  editedByAdmin: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};
