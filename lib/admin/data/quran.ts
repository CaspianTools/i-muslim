import "server-only";
import { getDb } from "@/lib/firebase/admin";
import type { AdminSurah, AdminAyah } from "@/types/admin-content";

export type { AdminSurah, AdminAyah };

export type SurahsResult = {
  surahs: AdminSurah[];
  source: "firestore" | "empty";
};

export type AyahsResult = {
  surah: AdminSurah | null;
  ayahs: AdminAyah[];
  source: "firestore" | "empty";
};

function tsToIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "object" && v && "toDate" in v) {
    const fn = (v as { toDate: () => Date }).toDate;
    if (typeof fn === "function") return fn.call(v).toISOString();
  }
  return null;
}

export async function fetchSurahs(): Promise<SurahsResult> {
  const db = getDb();
  if (!db) return { surahs: [], source: "empty" };
  const snap = await db.collection("quran_surahs").get();
  if (snap.empty) return { surahs: [], source: "empty" };

  // Count edited ayahs per surah in parallel.
  const editedSnap = await db
    .collection("quran_ayahs")
    .where("editedByAdmin", "==", true)
    .get();
  const editedCounts = new Map<number, number>();
  for (const d of editedSnap.docs) {
    const surah = (d.data() as { surah: number }).surah;
    editedCounts.set(surah, (editedCounts.get(surah) ?? 0) + 1);
  }

  const surahs: AdminSurah[] = snap.docs
    .map((d) => {
      const r = d.data() as Record<string, unknown>;
      return {
        number: r.number as number,
        name_ar: (r.name_ar as string) ?? "",
        name_en: (r.name_en as string) ?? "",
        name_translated: (r.name_translated as string) ?? "",
        revelation_place: (r.revelation_place as "makkah" | "madinah") ?? "makkah",
        ayah_count: (r.ayah_count as number) ?? 0,
        bismillah_pre: Boolean(r.bismillah_pre),
        edited_count: editedCounts.get(r.number as number) ?? 0,
      };
    })
    .sort((a, b) => a.number - b.number);

  return { surahs, source: "firestore" };
}

export async function fetchSurahWithAyahs(surah: number): Promise<AyahsResult> {
  const db = getDb();
  if (!db) return { surah: null, ayahs: [], source: "empty" };

  const [surahDoc, ayahsSnap] = await Promise.all([
    db.collection("quran_surahs").doc(String(surah)).get(),
    db.collection("quran_ayahs").where("surah", "==", surah).get(),
  ]);

  if (!surahDoc.exists) return { surah: null, ayahs: [], source: "empty" };

  const sr = surahDoc.data() as Record<string, unknown>;
  const surahMeta: AdminSurah = {
    number: sr.number as number,
    name_ar: (sr.name_ar as string) ?? "",
    name_en: (sr.name_en as string) ?? "",
    name_translated: (sr.name_translated as string) ?? "",
    revelation_place: (sr.revelation_place as "makkah" | "madinah") ?? "makkah",
    ayah_count: (sr.ayah_count as number) ?? 0,
    bismillah_pre: Boolean(sr.bismillah_pre),
  };

  const ayahs: AdminAyah[] = ayahsSnap.docs
    .map((d) => {
      const r = d.data() as Record<string, unknown>;
      const rawTranslations = (r.translations as Record<string, unknown> | undefined) ?? {};
      const translations: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawTranslations)) {
        translations[k] = typeof v === "string" ? v : "";
      }
      const rawEdited = (r.editedTranslations as Record<string, unknown> | undefined) ?? {};
      const editedTranslations: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(rawEdited)) {
        if (v === true) editedTranslations[k] = true;
      }
      return {
        id: d.id,
        surah: r.surah as number,
        ayah: r.ayah as number,
        text_ar: (r.text_ar as string) ?? "",
        text_translit: (r.text_translit as string) ?? null,
        translations,
        editedTranslations,
        juz: (r.juz as number) ?? 0,
        page: (r.page as number) ?? 0,
        sajdah: Boolean(r.sajdah),
        tags: ((r.tags as string[]) ?? []),
        notes: (r.notes as string) ?? null,
        published: r.published !== false,
        editedByAdmin: Boolean(r.editedByAdmin),
        updatedAt: tsToIso(r.updatedAt),
        updatedBy: (r.updatedBy as string) ?? null,
      };
    })
    .sort((a, b) => a.ayah - b.ayah);

  return { surah: surahMeta, ayahs, source: "firestore" };
}
