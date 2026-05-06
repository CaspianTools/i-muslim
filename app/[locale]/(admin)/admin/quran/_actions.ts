"use server";

import { z } from "zod";
import { requirePermissionForLanguage } from "@/lib/permissions/server";
import { requireDb } from "@/lib/firebase/admin";
import { getGeminiConfig } from "@/lib/admin/data/secrets";
import { translateSacredText } from "@/lib/admin/ai/gemini-translate";
import { ALL_LANGS, type LangCode } from "@/lib/translations";

const NON_ARABIC_LANGS = ALL_LANGS.filter((l) => l !== "ar") as [LangCode, ...LangCode[]];

const translateSchema = z.object({
  surah: z.number().int().min(1).max(114),
  ayah: z.number().int().positive(),
  targetLang: z.enum(NON_ARABIC_LANGS as unknown as [string, ...string[]]),
});

export type TranslateAyahFieldResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function translateAyahFieldAction(
  rawInput: unknown,
): Promise<TranslateAyahFieldResult> {
  const parsed = translateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  await requirePermissionForLanguage("quran.translate", parsed.data.targetLang);

  const config = await getGeminiConfig();
  if (!config) {
    return {
      ok: false,
      error: "Gemini API key not configured. Add one in /admin/settings → AI translation.",
    };
  }

  const db = requireDb();
  const id = `${parsed.data.surah}:${parsed.data.ayah}`;
  const snap = await db.collection("quran_ayahs").doc(id).get();
  if (!snap.exists) {
    return { ok: false, error: `Ayah ${id} not found.` };
  }
  const data = snap.data() ?? {};
  const arabic = (data.text_ar as string | undefined) ?? "";
  const translations = (data.translations as Record<string, string | undefined>) ?? {};
  const englishContext = translations.en ?? null;

  return translateSacredText({
    arabic,
    englishContext,
    targetLang: parsed.data.targetLang as LangCode,
    sourceKind: "ayah",
    config,
  });
}
